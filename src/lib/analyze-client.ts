'use client';

import { supabase } from './supabase';
import { SYSTEM_PROMPT, MODULE_PROMPTS } from './prompts';

/** SHA-256 hashing in browser via Web Crypto API */
async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

export async function analyzeScript(
  params: AnalyzeParams,
  callbacks: AnalyzeCallbacks,
  abortController: AbortController,
) {
  const { scriptContent, modules } = params;
  const { onChunk, onError } = callbacks;

  try {
    // ── 1. Auth ──
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      onError('未登录，请先登录');
      return;
    }
    const userId = session.user.id;

    // ── 2. Rate limit ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const freeLimit = 3;

    const { count: used } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());

    if ((used ?? 0) >= freeLimit) {
      onError(`今日免费次数已用完（${freeLimit}/${freeLimit}）。请明天再试。`);
      return;
    }

    // ── 3. Cache check ──
    const scriptHash = await sha256(scriptContent);
    const modulesKey = [...modules].sort().join(',');

    const { data: cached } = await supabase
      .from('reports')
      .select('full_report')
      .eq('user_id', userId)
      .eq('script_hash', scriptHash)
      .eq('modules', modulesKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.full_report) {
      // Simulate streaming for cached result
      onChunk(cached.full_report);
      callbacks.onComplete(cached.full_report);
      return;
    }

    // ── 4. Build system prompt dynamically (from module content) ──
    // Modules are already resolved in page.tsx via MODULE_PROMPTS; 
    // we rely on the server-side prompt that's already in route.ts.
    // For browser-side, we'll send the modules to DeepSeek which handles 
    // the prompt internally. But we need the actual prompts...
    // 
    // Since MODULE_PROMPTS and SYSTEM_PROMPT are in route.ts (server-only),
    // we need them available client-side too.
    // 
    // For now, we construct a minimal system message and let the backend
    // modules be handled by a separate approach.
    //
    // ACTUAL FIX: Import prompts from a shared module

    // ── 4. Build system prompt ──
    const systemMsg = buildSysMsg(modules);

    // ── 5. Call DeepSeek ──
    const DEEPSEEK_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || 'sk-sk-1254b8a706794a0ba5b3f03130084242';
    const DEEPSEEK_BASE = process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

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
          { role: 'user', content: scriptContent },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 16000,
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

    // ── 6. Stream & collect ──
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
          /* skip */
        }
      }
    }

    // ── 7. Persist ──
    try {
      const tokenEst = Math.ceil(fullContent.length / 3);

      const { data: script } = await supabase
        .from('scripts')
        .insert({
          user_id: userId,
          title: scriptContent.slice(0, 200).replace(/\n/g, ' ').trim() || '未命名剧本',
          content: scriptContent,
          word_count: scriptContent.length,
        })
        .select('id')
        .single();

      const scriptId = script?.id;

      if (scriptId && fullContent) {
        await supabase.from('reports').insert({
          script_id: scriptId,
          user_id: userId,
          full_report: fullContent,
          script_hash: scriptHash,
          modules: modulesKey,
          token_count: tokenEst,
        });
      }

      await supabase.from('usage_logs').insert({
        user_id: userId,
        script_id: scriptId ?? null,
        token_count: tokenEst,
      });
    } catch (e) {
      console.error('Failed to persist:', e);
      // Non-fatal: analysis already delivered
    }

    callbacks.onComplete(fullContent);
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') return;
    console.error('Analyze error:', err);
    onError('分析失败，请重试');
  }
}
