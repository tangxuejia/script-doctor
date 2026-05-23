'use client';

import { SYSTEM_PROMPT, GENERATION_PROMPT } from './prompts';

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
  maxTokens: number = 65536,
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
      max_tokens: maxTokens,
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

// 诊断：只分析不生成
export async function analyzeScript(
  scriptContent: string,
  callbacks: AnalyzeCallbacks,
  abortController: AbortController,
) {
  try {
    const output = await callDeepSeek(SYSTEM_PROMPT, scriptContent, callbacks.onChunk, abortController.signal, 65536);
    callbacks.onComplete(output);
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') return;
    console.error('Analyze error:', err);
    callbacks.onError((err as Error).message || '诊断失败');
  }
}

// 生成：基于诊断报告输出新剧本
export async function generateScript(
  scriptContent: string,
  report: string,
  callbacks: AnalyzeCallbacks,
  abortController: AbortController,
) {
  try {
    const userContent = `原始剧本：\n\n${scriptContent}\n\n---\n诊断报告：\n\n${report}\n\n请根据诊断报告的建议，输出完整的优化后剧本。`;
    const output = await callDeepSeek(GENERATION_PROMPT, userContent, callbacks.onChunk, abortController.signal, 131072);
    callbacks.onComplete(output);
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') return;
    console.error('Generate error:', err);
    callbacks.onError((err as Error).message || '生成失败');
  }
}
