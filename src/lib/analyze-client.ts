'use client';

import { SYSTEM_PROMPT, MODULE_PROMPTS } from './prompts';

function buildSysMsg(modules: string[]): string {
  const extras = modules
    .filter((m) => MODULE_PROMPTS[m])
    .map((m) => MODULE_PROMPTS[m])
    .join('\n\n');
  return extras ? `${SYSTEM_PROMPT}\n\n${extras}` : SYSTEM_PROMPT;
}

interface AnalyzeParams {
  scriptContent: string;
  modules: string[];
  report?: string;
  /** 批次信息：第几批/共几批 */
  batchNum?: number;
  batchTotal?: number;
  /** 剧本总集数 */
  totalEpisodes?: number;
}

interface AnalyzeCallbacks {
  onChunk: (chunk: string) => void;
  onError: (error: string) => void;
  onComplete: (fullContent: string) => void;
}

export async function analyzeScript(
  params: AnalyzeParams,
  callbacks: AnalyzeCallbacks,
  abortController: AbortController,
) {
  const { scriptContent, modules } = params;
  const { onChunk, onError } = callbacks;

  try {
    // Build system prompt from selected modules
    const systemMsg = buildSysMsg(modules);

    // DeepSeek API config (injected at build time via NEXT_PUBLIC_*)
    const DEEPSEEK_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    if (!DEEPSEEK_KEY) {
      onError('API Key 未配置，请联系管理员');
      return;
    }
    const DEEPSEEK_BASE = process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    const userContent = (() => {
      const base = scriptContent;
      if (params.report && params.batchTotal) {
        // 改写模式 + 分批
        return `原始剧本（第 ${params.batchNum}/${params.batchTotal} 批，共${params.totalEpisodes || '?'}集）：\n\n${base}\n\n---\n以下是完整的分析报告（仅作参考，请针对本批剧集提取相关建议）：\n\n${params.report.slice(0, 6000)}\n\n**重要：必须输出本批次每一集的完整重写版剧本，格式与原剧本一致（X-Y 集-场格式），严禁只给大纲！**`;
      }
      if (params.report) {
        // 改写模式（单次）
        return `原始剧本：\n\n${base}\n\n---\n分析报告：\n\n${params.report}\n\n请根据以上分析报告中的诊断和建议，重写优化原始剧本，输出一部完整的新剧本。`;
      }
      if (params.batchTotal) {
        // 诊断模式 + 分批
        return `以下是${params.totalEpisodes || '全'}集剧本的第 ${params.batchNum}/${params.batchTotal} 批（共${params.totalEpisodes || '?'}集）。\n\n**重要：必须对以下每一集进行详细分析，包括具体的场景、对白、人物评价，严禁只给大纲或概述！**\n\n${base}`;
      }
      return base;
    })();

    const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userContent },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 32000,
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        onError('AI 服务调用频率过高，请稍后重试');
      } else {
        onError(`AI 服务错误 (${response.status})，请稍后重试`);
      }
      return;
    }

    // Stream & collect
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const data = JSON.parse(line.slice(6));
          const content: string = data.choices?.[0]?.delta?.content ?? '';
          if (content) {
            fullContent += content;
            onChunk(content);
          }
        } catch {
          /* skip malformed chunks */
        }
      }
    }

    callbacks.onComplete(fullContent);
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') return;
    console.error('Analyze error:', err);
    onError('分析失败，请重试');
  }
}
