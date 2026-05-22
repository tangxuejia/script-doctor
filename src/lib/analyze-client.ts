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

    const userContent = params.report
      ? `原始剧本：\n\n${scriptContent}\n\n---\n分析报告：\n\n${params.report}\n\n请根据以上分析报告中的诊断和建议，重写优化原始剧本，输出一部完整的新剧本。`
      : scriptContent;

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
