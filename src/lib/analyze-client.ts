'use client';

import { SYSTEM_PROMPT, MODULE_PROMPTS, getM18Prompt } from './prompts';
import { MODULE_LAYERS, sortByLayer } from './module-deps';

function buildSysMsg(params: {
  modules: string[];
  m18Level?: 'standard' | 'premium' | 'remake';
  platforms?: string[];
  prevContext?: string;
}): string {
  const { modules, m18Level, platforms, prevContext } = params;

  // M18 standalone mode: no diagnostic modules, just generate optimized script
  if (m18Level && modules.length === 0) {
    return getM18Prompt(m18Level, platforms);
  }

  const extras = modules
    .filter((m) => MODULE_PROMPTS[m])
    .map((m) => MODULE_PROMPTS[m])
    .join('\n\n');
  let msg = extras ? `${SYSTEM_PROMPT}\n\n${extras}` : SYSTEM_PROMPT;
  if (prevContext) {
    msg += `\n\n## 前置模块分析结果（请基于以下结论分析，不要重复诊断）\n\n${prevContext.slice(0, 6000)}`;
  }
  return msg;
}

interface AnalyzeParams {
  scriptContent: string;
  modules: string[];
  platforms?: string[];
  report?: string;
  m18Level?: 'standard' | 'premium' | 'remake';
}

interface AnalyzeCallbacks {
  onChunk: (chunk: string) => void;
  onError: (error: string) => void;
  onComplete: (fullContent: string) => void;
}

/** 单次 DeepSeek 调用 */
async function callDeepSeek(
  systemMsg: string,
  userContent: string,
  onChunk: (c: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const DEEPSEEK_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  if (!DEEPSEEK_KEY) throw new Error('API Key 未配置');
  const DEEPSEEK_BASE = process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

  const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userContent },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 65536,
    }),
    signal,
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('AI 服务调用频率过高，请稍后重试');
    throw new Error(`AI 服务错误 (${response.status})，请稍后重试`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const data = JSON.parse(line.slice(6));
        const content: string = data.choices?.[0]?.delta?.content ?? '';
        if (content) { full += content; onChunk(content); }
      } catch { /* skip */ }
    }
  }
  return full;
}

export async function analyzeScript(
  params: AnalyzeParams,
  callbacks: AnalyzeCallbacks,
  abortController: AbortController,
) {
  const { scriptContent, modules } = params;
  const { onChunk, onError } = callbacks;

  try {
    // M18 standalone mode: generate optimized script from report
    if (params.report && params.m18Level && modules.length === 0) {
      const userContent = `原始剧本：\n\n${scriptContent}\n\n---\n诊断报告：\n\n${params.report}\n\n请根据以上诊断报告中的建议进行优化改写。`;
      const sysMsg = buildSysMsg({ modules: [], m18Level: params.m18Level, platforms: params.platforms });
      const output = await callDeepSeek(sysMsg, userContent, onChunk, abortController.signal);
      callbacks.onComplete(output);
      return;
    }

    const userContent = params.platforms && params.platforms.length > 0
      ? `目标平台：${params.platforms.join('、')}\n\n${scriptContent}`
      : scriptContent;

    // ── 分层执行 ──
    const sorted = sortByLayer(modules);
    const layers = new Map<number, string[]>();
    sorted.forEach(m => {
      const layer = MODULE_LAYERS[m] || 99;
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer)!.push(m);
    });

    // 同层模块合并为一次调用
    const ordered = Array.from(layers.entries()).sort(([a], [b]) => a - b);

    let fullOutput = '';
    const allContexts: string[] = [];

    for (let i = 0; i < ordered.length; i++) {
      if (abortController.signal.aborted) break;
      const [layerNum, layerModules] = ordered[i];
      const layerName = ['', '诊断层', '分析层', '方案层', '商业化层'][layerNum] || `第${layerNum}层`;

      // Single layer → run now
      if (ordered.length === 1) {
        const sysMsg = buildSysMsg({ modules: layerModules, m18Level: params.m18Level, platforms: params.platforms });
        const output = await callDeepSeek(sysMsg, userContent, onChunk, abortController.signal);
        callbacks.onComplete(output);
        return;
      }

      // Multi-layer → accumulate context from all previous layers
      const prevContext = allContexts.length > 0
        ? allContexts.map(c => c.slice(-2000)).join('\n---\n')
        : undefined;
      onChunk(`\n\n## ${layerName}\n\n`);
      const sysMsg = buildSysMsg({ modules: layerModules, m18Level: params.m18Level, platforms: params.platforms, prevContext });
      const output = await callDeepSeek(sysMsg, userContent, onChunk, abortController.signal);
      fullOutput += output;
      allContexts.push(output);
    }

    callbacks.onComplete(fullOutput);
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') return;
    console.error('Analyze error:', err);
    onError((err as Error).message || '分析失败，请重试');
  }
}
