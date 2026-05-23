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
}

interface AnalyzeCallbacks {
  onChunk: (chunk: string) => void;
  onError: (error: string) => void;
  onComplete: (fullContent: string) => void;
}

async function callDeepSeek(
  systemMsg: string,
  userContent: string,
  onChunk: (c: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL;
  if (!baseUrl) throw new Error('API 配置缺失');

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
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
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`API 错误 (${res.status})${msg ? ': ' + msg.slice(0, 200) : ''}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('API 响应异常');

  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
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
    const sysMsg = buildSysMsg(modules);
    const output = await callDeepSeek(sysMsg, scriptContent, onChunk, abortController.signal);
    callbacks.onComplete(output);
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') return;
    console.error('Analyze error:', err);
    onError((err as Error).message || '分析失败，请重试');
  }
}
