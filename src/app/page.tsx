'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useScriptStore, SolutionVersion } from '@/store/useScriptStore';
import { analyzeScript } from '@/lib/analyze-client';
import DropZone from '@/components/DropZone';
import TextInput from '@/components/TextInput';
import ModuleSelector from '@/components/ModuleSelector';
import ErrorAlert from '@/components/ErrorAlert';

/* ── Design Tokens ── */
const VERSIONS = [
  { id: 'M15_STANDARD' as SolutionVersion, label: '标准版', icon: '✦', desc: '快速打磨', sub: '对白+细节优化 · 不改结构', color: '#f59e0b', bg: '#fffbeb', ring: 'ring-amber-400' },
  { id: 'M15_DEEP'    as SolutionVersion, label: '深度版', icon: '◆', desc: '结构优化', sub: '情节调整+人物深化 · 冲击精品', color: '#3b82f6', bg: '#eff6ff', ring: 'ring-blue-400' },
  { id: 'M15_REMAKE'  as SolutionVersion, label: '重塑版', icon: '★', desc: '全面重塑', sub: '立意升级+关系重构 · 冲击S+', color: '#8b5cf6', bg: '#f5f3ff', ring: 'ring-purple-400' },
];

type InputTab = 'file' | 'text';

/** 检测剧本总集数 */
function detectEpisodeCount(content: string): number {
  const patterns = [/第(\d+)集/g, /^\d+-1\b/gm, /Episode\s+(\d+)/gi];
  let max = 0;
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) {
      max = Math.max(max, parseInt(m[1]));
    }
  }
  return max || 1;
}

/** 按集数切割剧本，每批约10集 */
function chunkByEpisodes(content: string, chunkSize = 10): string[] {
  const epPattern = /(?:^|\n)(第\d+集[^\n]*|Episode\s+\d+[^\n]*)/gim;
  const matches: RegExpExecArray[] = [];
  let m;
  while ((m = epPattern.exec(content)) !== null) {
    matches.push(m);
  }
  if (matches.length <= 1) return [content];

  const indices = matches.map(m => m.index!);
  const chunks: string[] = [];
  for (let i = 0; i < indices.length; i += chunkSize) {
    const start = indices[i];
    const endIdx = i + chunkSize;
    const end = endIdx < indices.length ? indices[endIdx] : content.length;
    chunks.push(content.slice(start, end));
  }
  return chunks.length > 0 ? chunks : [content];
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

export default function Home() {
  const {
    scriptContent, setScriptContent,
    selectedModules, isAnalyzing, error, report,
    solutionVersion, toggleModule,
    setIsAnalyzing, appendReport, setError, setSolutionVersion, reset,
  } = useScriptStore();

  const [tab, setTab] = useState<InputTab>('file');
  const [analysisDone, setAnalysisDone] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revised, setRevised] = useState('');
  const [batchProgress, setBatchProgress] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const wordCount = scriptContent.length;
  const episodeCount = detectEpisodeCount(scriptContent);
  const batchCount = episodeCount > 15 ? Math.ceil(episodeCount / 10) : 1;

  // Redundant safety: listen for global file load event
  useEffect(() => {
    const handler = (e: Event) => {
      const content = (e as CustomEvent).detail as string;
      if (content) setScriptContent(content);
    };
    window.addEventListener('script:loaded', handler);
    return () => window.removeEventListener('script:loaded', handler);
  }, [setScriptContent]);
  const currentStep = !report ? 1 : !analysisDone ? 2 : !revised ? 3 : 4;

  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing || !scriptContent.trim() || scriptContent.length < 100) return;

    reset(); setAnalysisDone(false); setRevised(''); setBatchProgress('');
    setIsAnalyzing(true); setError(null);

    const totalEpisodes = detectEpisodeCount(scriptContent);
    const chunks = totalEpisodes > 15
      ? chunkByEpisodes(scriptContent, 10)
      : [scriptContent];
    const isBatch = chunks.length > 1;
    const CONCURRENCY = 3;
    const results: string[] = new Array(chunks.length).fill('');
    let done = 0;

    try {
      const queue = chunks.map((_, i) => i);

      const runOne = async (idx: number) => {
        await new Promise<void>((resolve, reject) => {
          const ctrl = new AbortController();
          analyzeScript({
            scriptContent: chunks[idx],
            modules: selectedModules,
            ...(isBatch ? { batchNum: idx + 1, batchTotal: chunks.length, totalEpisodes } : {}),
          }, {
            onChunk: (c) => { results[idx] += c; },
            onError: (m) => { reject(new Error(m)); },
            onComplete: () => resolve(),
          }, ctrl);
        });
        done++;
        if (isBatch) setBatchProgress(`已完成 ${done}/${chunks.length} 批（共${totalEpisodes}集）`);
      };

      const workers: Promise<void>[] = [];
      const launch = () => {
        if (queue.length === 0) return null;
        const idx = queue.shift()!;
        const p = runOne(idx).finally(() => {
          workers.splice(workers.indexOf(p), 1);
          launch();
        });
        workers.push(p);
        return p;
      };

      for (let i = 0; i < Math.min(CONCURRENCY, chunks.length); i++) launch();
      while (workers.length > 0) await Promise.race(workers);

      for (let i = 0; i < chunks.length; i++) {
        if (isBatch) appendReport(`\n\n===== 第 ${i + 1}/${chunks.length} 批分析 =====\n\n`);
        appendReport(results[i]);
      }
      setIsAnalyzing(false);
      setAnalysisDone(true);
      setBatchProgress('');
    } catch (err) {
      setError((err as Error).message || '分析失败');
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, scriptContent, selectedModules, appendReport, reset, setError, setIsAnalyzing]);

  const handleRevise = useCallback(async () => {
    if (revising) return;
    setRevising(true); setRevised(''); setError(null); setBatchProgress('');

    const totalEpisodes = detectEpisodeCount(scriptContent);
    const chunks = totalEpisodes > 15
      ? chunkByEpisodes(scriptContent, 10)
      : [scriptContent];
    const isBatch = chunks.length > 1;
    const CONCURRENCY = 3;
    const results: string[] = new Array(chunks.length).fill('');
    let done = 0;

    try {
      const queue = chunks.map((_, i) => i);

      const runOne = async (idx: number) => {
        await new Promise<void>((resolve, reject) => {
          const ctrl = new AbortController();
          analyzeScript({
            scriptContent: chunks[idx],
            modules: [solutionVersion],
            report,
            ...(isBatch ? { batchNum: idx + 1, batchTotal: chunks.length, totalEpisodes } : {}),
          }, {
            onChunk: (c) => { results[idx] += c; },
            onError: (m) => { reject(new Error(m)); },
            onComplete: () => resolve(),
          }, ctrl);
        });
        done++;
        if (isBatch) setBatchProgress(`已完成 ${done}/${chunks.length} 批（共${totalEpisodes}集）`);
      };

      const workers: Promise<void>[] = [];
      const launch = () => {
        if (queue.length === 0) return null;
        const idx = queue.shift()!;
        const p = runOne(idx).finally(() => {
          workers.splice(workers.indexOf(p), 1);
          launch();
        });
        workers.push(p);
        return p;
      };

      for (let i = 0; i < Math.min(CONCURRENCY, chunks.length); i++) launch();
      while (workers.length > 0) await Promise.race(workers);

      for (let i = 0; i < chunks.length; i++) {
        setRevised((p) => p + (isBatch ? `\n\n===== 第 ${i + 1}/${chunks.length} 批改写 =====\n\n` : ''));
        setRevised((p) => p + results[i]);
      }
      setRevising(false);
      setBatchProgress('');
    } catch (err) {
      setError((err as Error).message || '改写失败');
      setRevising(false);
    }
  }, [revising, scriptContent, solutionVersion, report, setError]);

  const ver = VERSIONS.find(v => v.id === solutionVersion)!;

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
        <p className="mt-1 text-sm text-gray-400">AI 剧本诊断 · 多维分析 · 智能改写</p>
      </header>

      {/* ── Step indicators ── */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {['上传剧本', '智能分析', '选择方案', '导出剧本'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${
              currentStep > i + 1 ? 'bg-emerald-500 text-white' :
              currentStep === i + 1 ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300' :
              'bg-gray-100 text-gray-400'
            }`}>
              {currentStep > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${
              currentStep >= i + 1 ? 'text-gray-700' : 'text-gray-300'
            }`}>{label}</span>
            {i < 3 && <div className={`mx-1 h-px w-6 sm:w-10 ${currentStep > i + 1 ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      <section className={`rounded-2xl border bg-white p-6 transition-all duration-500 ${currentStep === 1 ? 'border-emerald-200 shadow-lg shadow-emerald-50' : 'border-gray-100 shadow-sm'}`}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-600">1</span>
          <h2 className="text-base font-semibold text-gray-800">剧本输入</h2>
        </div>

        <div className="mb-4 flex rounded-xl bg-gray-50 p-1">
          {(['file', 'text'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                tab === t ? 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {t === 'file' ? '📁 上传文件' : '✏️ 粘贴文本'}
            </button>
          ))}
        </div>

        {tab === 'file'
          ? <DropZone onFileLoaded={setScriptContent} />
          : <TextInput value={scriptContent} onChange={setScriptContent} />
        }

        {scriptContent.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              已输入 <strong className="text-gray-600">{wordCount.toLocaleString()}</strong> 字
            </span>
            {episodeCount > 1 && (
              <span className="flex items-center gap-1">
                · 检测到 <strong className="text-gray-600">{episodeCount}</strong> 集
                {batchCount > 1 && (
                  <span className="text-amber-500">（将分 {batchCount} 批分析）</span>
                )}
              </span>
            )}
            {scriptContent.length >= 100 ? ' ✓ 可分析' : ' ⚠ 至少需要 100 字'}
          </div>
        )}
      </section>

      {/* ── Step 2: Modules + Analyze ── */}
      <section className={`mt-4 rounded-2xl border bg-white p-6 transition-all duration-500 ${currentStep >= 2 ? 'border-emerald-200 shadow-lg shadow-emerald-50' : 'border-gray-100 shadow-sm'}`}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-600">2</span>
          <h2 className="text-base font-semibold text-gray-800">分析模块</h2>
          <span className="text-xs text-gray-400">（可多选）</span>
        </div>

        <ModuleSelector selected={selectedModules} onToggle={toggleModule} disabled={isAnalyzing} />

        {/* Batch progress */}
        {batchProgress && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {batchProgress}
          </div>
        )}

        <button onClick={handleAnalyze} disabled={isAnalyzing || scriptContent.length < 100}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] shadow-md shadow-emerald-200 disabled:opacity-40 disabled:shadow-none">
          {isAnalyzing ? <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            AI 正在分析...
          </> : <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
            开始诊断（{wordCount.toLocaleString()} 字）
          </>}
        </button>
      </section>

      {/* Error */}
      {error && <div className="mt-4"><ErrorAlert error={error} onRetry={handleAnalyze} onDismiss={() => setError(null)} /></div>}

      {/* ── Report ── */}
      {report && (
        <section className={`mt-4 rounded-2xl border bg-white p-6 transition-all duration-500 ${currentStep >= 3 ? 'border-gray-100 shadow-sm' : 'border-emerald-200 shadow-lg shadow-emerald-50'}`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white ${analysisDone ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}>
                {analysisDone ? '✓' : '⏳'}
              </span>
              <h2 className="text-base font-semibold text-gray-800">诊断报告</h2>
            </div>
            {analysisDone && (
              <div className="flex gap-2">
                <button onClick={() => downloadFile(report, '诊断报告.txt', 'text/plain')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">导出 TXT</button>
                <button onClick={() => downloadFile(report, '诊断报告.md', 'text/markdown')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">导出 MD</button>
              </div>
            )}
          </div>
          <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-600 prose-strong:text-gray-700 max-h-[500px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-600 scrollbar-thin">{report}</div>
        </section>
      )}

      {/* ── Step 3: Version selector ── */}
      {analysisDone && (
        <section className={`mt-4 rounded-2xl border p-6 transition-all duration-500 ${revised ? 'border-gray-100 shadow-sm' : 'border-emerald-200 shadow-lg shadow-emerald-50'} bg-gradient-to-br from-white to-emerald-50/30`}>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-600">3</span>
            <h2 className="text-base font-semibold text-gray-800">剧本改写方案</h2>
            <span className="text-xs text-gray-400">三选一</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {VERSIONS.map((v) => {
              const sel = solutionVersion === v.id;
              return (
                <button key={v.id} onClick={() => setSolutionVersion(v.id)} disabled={revising}
                  className={`relative flex flex-col items-center rounded-xl p-4 text-center transition-all disabled:opacity-50 ${
                    sel ? `ring-2 ${v.ring} shadow-lg` : 'border border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                  }`}
                  style={sel ? { backgroundColor: v.bg, borderColor: v.color } : undefined}>
                  <span className="text-2xl">{v.icon}</span>
                  <span className="mt-2 text-sm font-bold text-gray-800">{v.label}</span>
                  <span className="mt-0.5 text-xs font-medium" style={{ color: v.color }}>{v.desc}</span>
                  <span className="mt-1 text-[11px] text-gray-400 leading-tight">{v.sub}</span>
                  {sel && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow" style={{ backgroundColor: v.color }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Batch progress for revision */}
          {batchProgress && revising && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium" style={{ backgroundColor: ver.bg, color: ver.color }}>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              {batchProgress}
            </div>
          )}

          <button onClick={handleRevise} disabled={revising}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed shadow-md active:scale-[0.98]"
            style={{ backgroundColor: ver.color, opacity: revising ? 0.5 : 1 }}>
            {revising ? <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              正在重写...
            </> : <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
              开始{ver.label}改写
            </>}
          </button>

          {/* Revised output */}
          {revised && (
            <div className="mt-5 rounded-xl border-2 bg-white p-5" style={{ borderColor: ver.color }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ver.icon}</span>
                  <h3 className="text-sm font-bold" style={{ color: ver.color }}>新剧本 · {ver.label}</h3>
                </div>
                <div className="flex gap-2">
                  {[
                    ['TXT', () => downloadFile(revised, '新剧本.txt', 'text/plain')],
                    ['Word', () => { const h=`<meta charset="utf-8"><style>body{font-family:SimSun;line-height:2;padding:2cm}</style>${revised.replace(/\n/g,'<br>')}`; downloadFile(h,'新剧本.doc','application/msword') }],
                    ['PDF', () => { const w=open('','_blank'); if(w){ w.document.write(`<meta charset="utf-8"><title>新剧本</title><style>body{font-family:system-ui;max-width:800px;margin:auto;padding:2rem;line-height:2}</style>${revised.replace(/\n/g,'<br>')}`); w.document.close(); w.print() } }],
                  ].map(([l, fn]) => (
                    <button key={l as string} onClick={fn as () => void} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">{l as string}</button>
                  ))}
                </div>
              </div>
              <div className="prose prose-sm max-w-none max-h-[400px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-600 scrollbar-thin">{revised}</div>
            </div>
          )}
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="mt-12 text-center text-xs text-gray-300">
        Script Doctor · Powered by DeepSeek AI · 免费使用
      </footer>
    </div>
  );
}
