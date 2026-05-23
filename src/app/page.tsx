'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useScriptStore } from '@/store/useScriptStore';
import { analyzeScript, generateScript } from '@/lib/analyze-client';
import DropZone from '@/components/DropZone';
import TextInput from '@/components/TextInput';
import ErrorAlert from '@/components/ErrorAlert';

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

type InputTab = 'file' | 'text';

export default function Home() {
  const {
    scriptContent, setScriptContent,
    isAnalyzing, error, report,
    setIsAnalyzing, appendReport, setError, reset,
  } = useScriptStore();

  const [tab, setTab] = useState<InputTab>('file');
  const [analysisDone, setAnalysisDone] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newScript, setNewScript] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const wordCount = scriptContent.length;

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing || !scriptContent.trim() || scriptContent.length < 100) return;
    reset(); setAnalysisDone(false); setNewScript('');
    setIsAnalyzing(true); setError(null);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      await new Promise<void>((resolve, reject) => {
        analyzeScript(scriptContent, {
          onChunk: (c) => appendReport(c),
          onError: (m) => { reject(new Error(m)); },
          onComplete: () => resolve(),
        }, ctrl);
      });
      setIsAnalyzing(false);
      setAnalysisDone(true);
    } catch (err) {
      setError((err as Error).message || '分析失败');
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, scriptContent, appendReport, reset, setError, setIsAnalyzing]);

  const handleGenerate = useCallback(async () => {
    if (generating || !report) return;
    setGenerating(true); setNewScript(''); setError(null);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      await new Promise<void>((resolve, reject) => {
        generateScript(scriptContent, report, {
          onChunk: (c) => setNewScript((p) => p + c),
          onError: (m) => { reject(new Error(m)); },
          onComplete: () => resolve(),
        }, ctrl);
      });
      setGenerating(false);
    } catch (err) {
      setError((err as Error).message || '生成失败');
      setGenerating(false);
    }
  }, [generating, report, scriptContent, setError]);

  return (
    <div className="mx-auto min-h-screen max-w-[960px] px-4 py-8">
      {/* ── Header ── */}
      <header className="mb-10 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-teal-200">
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Script Doctor</h1>
        <p className="mt-1 text-sm text-gray-400">上传剧本 · 一键诊断 · 自动生成优化版</p>
      </header>

      {/* ── Upload ── */}
      <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-lg shadow-emerald-50">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-600">1</span>
          <h2 className="text-base font-semibold text-gray-800">剧本输入</h2>
        </div>
        <div className="mb-4 flex rounded-xl bg-gray-50 p-1">
          {(['file', 'text'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                tab === t ? 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'
              }`}>{t === 'file' ? '📁 上传文件' : '✏️ 粘贴文本'}</button>
          ))}
        </div>
        {tab === 'file' ? <DropZone onFileLoaded={setScriptContent} /> : <TextInput value={scriptContent} onChange={setScriptContent} />}
        {scriptContent.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />已输入 <strong className="text-gray-600">{wordCount.toLocaleString()}</strong> 字</span>
            {scriptContent.length >= 100 ? ' ✓ 可诊断' : ' ⚠ 至少需要 100 字'}
          </div>
        )}
      </section>

      {/* ── Analyze ── */}
      <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-600">2</span>
          <h2 className="text-base font-semibold text-gray-800">开始诊断</h2>
          <span className="text-xs text-gray-400">全栈剧本医生将对您的剧本进行全面诊断与优化重写</span>
        </div>
        <button onClick={handleAnalyze} disabled={isAnalyzing || scriptContent.length < 100}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] shadow-md shadow-emerald-200 disabled:opacity-40 disabled:shadow-none">
          {isAnalyzing ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>AI 正在诊断与重写...</> : <>开始诊断（{wordCount.toLocaleString()} 字）</>}
        </button>
        {isAnalyzing && (
          <button onClick={() => abortRef.current?.abort()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-all">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>停止诊断
          </button>
        )}
      </section>

      {/* Error */}
      {error && <div className="mt-4"><ErrorAlert error={error} onRetry={handleAnalyze} onDismiss={() => setError(null)} /></div>}

      {/* ── Report ── */}
      {report && (
        <section className="mt-4 rounded-2xl border border-emerald-200 bg-white p-6 shadow-lg shadow-emerald-50">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white ${analysisDone ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}>
                {analysisDone ? '✓' : '⏳'}
              </span>
              <h2 className="text-base font-semibold text-gray-800">诊断报告 · 优化剧本</h2>
            </div>
            {analysisDone && (
              <div className="flex gap-2">
                <button onClick={() => downloadFile(report, '诊断报告+优化剧本.txt', 'text/plain')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">导出 TXT</button>
                <button onClick={() => downloadFile(report, '诊断报告+优化剧本.md', 'text/markdown')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">导出 MD</button>
              </div>
            )}
          </div>
          <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-600 prose-strong:text-gray-700 max-h-[600px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-600 scrollbar-thin">{report}</div>
        </section>
      )}

      {/* ── Generate new script ── */}
      {analysisDone && (
        <section className="mt-4 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-600">3</span>
            <h2 className="text-base font-semibold text-gray-800">生成新剧本</h2>
            <span className="text-xs text-gray-400">基于诊断报告生成可直接投稿的完整剧本</span>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all disabled:opacity-40 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 active:scale-[0.98] shadow-md shadow-purple-200">
            {generating ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>正在生成新剧本...</> : '生成新剧本'}
          </button>
          {generating && (
            <button onClick={() => abortRef.current?.abort()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-all">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>停止生成
            </button>
          )}
          {newScript && (
            <div className="mt-5 rounded-xl border-2 border-purple-200 bg-purple-50/30 p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-purple-600">新剧本</span>
                <button onClick={() => downloadFile(newScript, '新剧本.txt', 'text/plain')}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">导出 TXT</button>
              </div>
              <div className="prose prose-sm max-w-none max-h-[400px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{newScript}</div>
            </div>
          )}
        </section>
      )}

      <footer className="mt-12 text-center text-xs text-gray-300">Script Doctor · Powered by DeepSeek AI · 免费使用</footer>
    </div>
  );
}
