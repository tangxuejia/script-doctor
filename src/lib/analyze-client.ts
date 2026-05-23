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

// 拆分剧本为集
function splitEpisodes(text: string): string[] {
  // 匹配各种格式的集数标记
  const pattern = /(?:^|\n)(?:第\s*\d+\s*集|Episode\s*\d+|Scene\s*\d+[:：])/gim;
  const matches: { index: number; text: string }[] = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    matches.push({ index: m.index + m[0].length, text: m[0].trim() });
  }

  if (matches.length === 0) return [text]; // no episode markers, treat as one

  const episodes: string[] = [];
  // Add header (everything before first episode)
  const firstEpStart = matches[0].index;
  if (text.slice(0, firstEpStart).trim()) {
    episodes.push(text.slice(0, firstEpStart).trim());
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const episodeContent = text.slice(start, end).trim();
    if (episodeContent) episodes.push(episodeContent);
  }
  return episodes;
}

// 诊断：超过10集自动分批
export async function analyzeScript(
  scriptContent: string,
  callbacks: AnalyzeCallbacks,
  abortController: AbortController,
) {
  try {
    const episodes = splitEpisodes(scriptContent);
    const header = episodes.length > 1 && !/(?:第\s*\d+\s*集|Episode)/i.test(episodes[0]) 
      ? episodes[0] : '';
    const epList = header ? episodes.slice(1) : episodes;

    // 10集一批
    const BATCH = 10;
    if (epList.length <= BATCH) {
      // 10集以内直接诊断
      const output = await callDeepSeek(SYSTEM_PROMPT, scriptContent, callbacks.onChunk, abortController.signal, 65536);
      callbacks.onComplete(output);
      return;
    }

    // 分批诊断
    callbacks.onChunk(`检测到 ${epList.length} 集，分 ${Math.ceil(epList.length / BATCH)} 批诊断\n\n`);
    let fullReport = '';

    for (let i = 0; i < epList.length; i += BATCH) {
      if (abortController.signal.aborted) break;
      const batchEps = epList.slice(i, i + BATCH);
      const batchContent = header 
        ? header + '\n\n' + batchEps.join('\n\n')
        : batchEps.join('\n\n');
      const startEp = i + 1;
      const endEp = Math.min(i + BATCH, epList.length);

      const batchPrompt = SYSTEM_PROMPT + `\n\n本次只诊断第${startEp}集到第${endEp}集。每集独立分析，不可跳过、不可合并。`;
      callbacks.onChunk(`\n=== 第 ${startEp}-${endEp} 集诊断 ===\n\n`);

      const output = await callDeepSeek(batchPrompt, batchContent, callbacks.onChunk, abortController.signal, 65536);
      fullReport += output + '\n\n';
    }

    callbacks.onComplete(fullReport);
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') return;
    console.error('Analyze error:', err);
    callbacks.onError((err as Error).message || '诊断失败');
  }
}

// 生成：基于诊断报告分批输出新剧本
export async function generateScript(
  scriptContent: string,
  report: string,
  callbacks: AnalyzeCallbacks,
  abortController: AbortController,
) {
  try {
    const episodes = splitEpisodes(scriptContent);
    const header = episodes.length > 1 && !/(?:第\s*\d+\s*集|Episode)/i.test(episodes[0]) 
      ? episodes[0] : '';
    const epList = header ? episodes.slice(1) : episodes;

    const BATCH = 10;
    if (epList.length <= BATCH) {
      const userContent = `原始剧本：\n\n${scriptContent}\n\n---\n完整诊断报告：\n\n${report}\n\n请根据以上诊断报告的建议，输出完整的优化后剧本。`;
      const output = await callDeepSeek(GENERATION_PROMPT, userContent, callbacks.onChunk, abortController.signal, 131072);
      callbacks.onComplete(output);
      return;
    }

    // 分批生成，每批拿到完整诊断报告
    callbacks.onChunk(`共 ${epList.length} 集，分 ${Math.ceil(epList.length / BATCH)} 批生成\n\n`);
    let fullScript = '';

    for (let i = 0; i < epList.length; i += BATCH) {
      if (abortController.signal.aborted) break;
      const batchEps = epList.slice(i, i + BATCH);
      const batchContent = header 
        ? header + '\n\n' + batchEps.join('\n\n')
        : batchEps.join('\n\n');
      const startEp = i + 1;
      const endEp = Math.min(i + BATCH, epList.length);

      const batchPrompt = GENERATION_PROMPT + `\n\n本次只生成第${startEp}集到第${endEp}集的剧本。必须参考完整的诊断报告（已提供），确保每集修改符合诊断建议。每集独立完整，逐集输出。`;
      const userContent = `原始剧本（第${startEp}-${endEp}集）：\n\n${batchContent}\n\n---\n完整诊断报告：\n\n${report}\n\n请根据诊断报告中的逐集建议，输出第${startEp}集到第${endEp}集的完整优化剧本。`;
      
      callbacks.onChunk(`\n=== 第 ${startEp}-${endEp} 集剧本 ===\n\n`);
      const output = await callDeepSeek(batchPrompt, userContent, callbacks.onChunk, abortController.signal, 65536);
      fullScript += output + '\n\n';
    }

    callbacks.onComplete(fullScript);
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') return;
    console.error('Generate error:', err);
    callbacks.onError((err as Error).message || '生成失败');
  }
}

// 对话修改剧本
export async function chatScript(
  newScript: string,
  report: string,
  conversation: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string,
  callbacks: AnalyzeCallbacks,
  abortController: AbortController,
) {
  const systemMsg = `你是一位剧本修改顾问。用户正在与你讨论修改一份已生成的剧本。

对话规则：
- 根据用户的修改要求，给出修改后的剧本片段
- 如果你同意用户的修改建议，直接输出修改后的内容
- 如果用户的建议有问题，礼貌指出并提供更好的方案
- 保持剧本格式规范（△动作、角色名：对白、〖字幕〗等）
- 你只输出需要修改的部分，不要重写整个剧本

以下是完整诊断报告供参考：
${report}`;

  const messages = [
    { role: 'assistant' as const, content: '剧本已生成，请告诉我你想修改哪些地方。' },
    ...conversation.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const baseUrl = process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL;
    if (!baseUrl) throw new Error('API 配置缺失');

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal,
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'system', content: systemMsg }, ...messages],
        stream: true,
        temperature: 0.5,
        max_tokens: 8192,
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
          if (content) { full += content; callbacks.onChunk(content); }
        } catch { /* skip */ }
      }
    }
    callbacks.onComplete(full);
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') return;
    callbacks.onError((err as Error).message || '对话失败');
  }
}
