'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useScriptStore, PLATFORMS, Platform } from '@/store/useScriptStore';
import { MODULES } from '@/store/modules';
import { analyzeScript } from '@/lib/analyze-client';
import { findMissingDeps, findAffectedModules, MODULE_CONFLICTS, MODULE_NAMES } from '@/lib/module-deps';
import DropZone from '@/components/DropZone';
import TextInput from '@/components/TextInput';
import ModuleSelector from '@/components/ModuleSelector';
import ErrorAlert from '@/components/ErrorAlert';

const ALL_MODULE_IDS = MODULES.map(m => m.id);

/* ── M18 level selector ── */
const M18_LEVELS = [
  { key: 'standard' as const, label: '标准优化版', desc: '基础过稿', color: '#10b981', bg: '#ecfdf5' },
  { key: 'premium' as const, label: '精品优化版', desc: '冲击高评级', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'viral' as const, label: '🔥 爆款优化版', desc: '冲击顶级流量', color: '#f59e0b', bg: '#fffbeb' },
];

type M18Level = typeof M18_LEVELS[number]['key'];

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
    selectedModules, isAnalyzing, error, report,
    toggleModule,
    setIsAnalyzing, appendReport, setError, reset,
    selectedPlatforms, togglePlatform, setSelectedModules,
  } = useScriptStore();

  const [tab, setTab] = useState<InputTab>('file');
  const [analysisDone, setAnalysisDone] = useState(false);
  const [depNotice, setDepNotice] = useState('');
  const [depNoticeType, setDepNoticeType] = useState<'info' | 'warn'>('info');
  const [m18Level, setM18Level] = useState<M18Level>('standard');
  const depTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);
  const wordCount = scriptContent.length;

  const handleToggleModule = useCallback((id: string) => {
    setDepNotice('');
    const willSelect = !selectedModules.includes(id);
    if (willSelect) {
      const deps = findMissingDeps([...selectedModules, id]);
      const newMods = Array.from(new Set([...selectedModules, id, ...deps]));
      setSelectedModules(newMods);
      if (deps.length > 0) {
        const names = deps.map(d => MODULE_NAMES[d] || d).join('、');
        setDepNoticeType('info');
        setDepNotice(`已自动勾选 ${names}（${id} 依赖此模块）`);
        clearTimeout(depTimerRef.current);
        depTimerRef.current = setTimeout(() => setDepNotice(''), 5000);
      }
    } else {
      toggleModule(id);
      const affected = findAffectedModules(id, selectedModules.filter(m => m !== id));
      if (affected.length > 0) {
        const names = affected.map(d => MODULE_NAMES[d] || d).join('、');
        setDepNoticeType('warn');
        setDepNotice(`⚠ ${names} 依赖 ${MODULE_NAMES[id] || id}，缺少此模块可能影响分析质量`);
        clearTimeout(depTimerRef.current);
        depTimerRef.current = setTimeout(() => setDepNotice(''), 6000);
      }
    }
  }, [selectedModules, toggleModule, setSelectedModules]);

  useEffect(() => {
    return () => {
      clearTimeout(depTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const currentStep = !report ? 1 : !analysisDone ? 2 : 3;

  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing || !scriptContent.trim() || scriptContent.length < 100) return;
    reset(); setAnalysisDone(false);
    setIsAnalyzing(true); setError(null);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      await new Promise<void>((resolve, reject) => {
        analyzeScript({ scriptContent, modules: selectedModules, platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined, m18Level: selectedModules.includes('M18') ? m18Level : undefined }, {
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
  }, [isAnalyzing, scriptContent, selectedModules, selectedPlatforms, appendReport, reset, setError, setIsAnalyzing]);

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
        {['上传剧本', '智能分析', '查看结果'].map((label, i) => (
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
            {i < 2 && <div className={`mx-1 h-px w-6 sm:w-10 ${currentStep > i + 1 ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
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

        {depNotice && (
          <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
            depNoticeType === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-indigo-200 bg-indigo-50 text-indigo-600'
          }`}>{depNotice}</div>
        )}

        {MODULE_CONFLICTS.map(([a, b, msg]) => {
          if (selectedModules.includes(a) && selectedModules.includes(b)) {
            return (
              <div key={`${a}-${b}`} className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                ⚠ {MODULE_NAMES[a]} + {MODULE_NAMES[b]}：{msg}
              </div>
            );
          }
          return null;
        }).filter(Boolean)}

        <ModuleSelector selected={selectedModules} onToggle={handleToggleModule} disabled={isAnalyzing}
          onSelectAll={(select) => setSelectedModules(select ? ALL_MODULE_IDS : [])}
          onSelectPreset={(ids) => setSelectedModules(ids)} />

        {/* M16 平台选择器 */}
        {selectedModules.includes('M16') && (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-indigo-600">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              选择目标平台（可多选）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => {
                const sel = selectedPlatforms.includes(p as Platform);
                return (
                  <button key={p} onClick={() => togglePlatform(p as Platform)} disabled={isAnalyzing}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      sel ? 'bg-indigo-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}>{p}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* M18 级别选择器 */}
        {selectedModules.includes('M18') && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="mb-2 text-xs font-medium text-emerald-600">选择优化级别</div>
            <div className="grid grid-cols-3 gap-2">
              {M18_LEVELS.map((l) => {
                const sel = m18Level === l.key;
                return (
                  <button key={l.key} onClick={() => setM18Level(l.key)} disabled={isAnalyzing}
                    className={`rounded-lg px-3 py-2 text-center text-xs font-medium transition-all ${
                      sel ? 'ring-2 shadow-sm' : 'border border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    style={sel ? { backgroundColor: l.bg, borderColor: l.color, color: l.color } : undefined}>
                    <div>{l.label}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">{l.desc}</div>
                  </button>
                );
              })}
            </div>
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

        {isAnalyzing && (
          <button onClick={() => abortRef.current?.abort()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-all">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            停止诊断
          </button>
        )}
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

          {/* Report content */}
          <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-600 prose-strong:text-gray-700 max-h-[500px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-600 scrollbar-thin">{report}</div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="mt-12 text-center text-xs text-gray-300">
        Script Doctor · Powered by DeepSeek AI · 免费使用
      </footer>
    </div>
  );
}
