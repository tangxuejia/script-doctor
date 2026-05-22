'use client';

import { useState, useCallback, useRef } from 'react';
import { useScriptStore, SolutionVersion } from '@/store/useScriptStore';
import { analyzeScript } from '@/lib/analyze-client';
import DropZone from '@/components/DropZone';
import TextInput from '@/components/TextInput';
import ModuleSelector from '@/components/ModuleSelector';
import ErrorAlert from '@/components/ErrorAlert';
import ScoreCards from '@/components/ScoreCards';

type InputTab = 'file' | 'text';

const VERSIONS: { id: SolutionVersion; label: string; emoji: string; desc: string; sub: string; color: 'orange' | 'blue' | 'amber' }[] = [
  { id: 'M15_STANDARD', label: '标准版', emoji: '🟠', desc: '快速打磨', sub: '不改结构', color: 'orange' },
  { id: 'M15_DEEP',    label: '深度版', emoji: '🔵', desc: '结构优化', sub: '冲击精品', color: 'blue' },
  { id: 'M15_REMAKE',  label: '重塑版', emoji: '🟡🏆', desc: '全面重塑', sub: '冲击S+级', color: 'amber' },
];

const VER_COLORS = {
  orange: { border: 'border-orange-400', bg: 'bg-orange-50', dot: 'bg-orange-500', text: 'text-orange-700', ring: 'ring-orange-200' },
  blue:   { border: 'border-blue-400',   bg: 'bg-blue-50',   dot: 'bg-blue-500',   text: 'text-blue-700',   ring: 'ring-blue-200' },
  amber:  { border: 'border-amber-400',  bg: 'bg-amber-50',  dot: 'bg-amber-500',  text: 'text-amber-700',  ring: 'ring-amber-200' },
};

/* ── Export helpers ── */
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTxt(text: string) {
  downloadFile(text, '修改方案.txt', 'text/plain;charset=utf-8');
}

function exportDocx(text: string) {
  const html = `<html><head><meta charset="utf-8"><style>body{font-family:SimSun,serif;line-height:2;padding:2cm}</style></head><body>${text.replace(/\n/g, '<br>')}</body></html>`;
  downloadFile(html, '修改方案.doc', 'application/msword');
}

function exportPdf(text: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<html><head><meta charset="utf-8"><title>修改方案</title><style>body{font-family:system-ui;max-width:800px;margin:auto;padding:2rem;line-height:2}</style></head><body>${text.replace(/\n/g, '<br>')}</body></html>`);
  win.document.close();
  win.print();
}

export default function Home() {
  const {
    scriptContent, selectedModules, isAnalyzing, error, report,
    solutionVersion, setScriptContent, toggleModule,
    setIsAnalyzing, appendReport, setError, setSolutionVersion,
    reset,
  } = useScriptStore();

  const [tab, setTab] = useState<InputTab>('file');
  const [analysisDone, setAnalysisDone] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revised, setRevised] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  /* ── 1. Initial analysis ── */
  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing) return;
    if (!scriptContent.trim()) { setError('请先输入剧本内容'); return; }
    if (scriptContent.length < 100) { setError(`至少需要100字（当前${scriptContent.length}字）`); return; }

    reset();
    setAnalysisDone(false);
    setRevised('');
    setIsAnalyzing(true);
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    analyzeScript(
      { scriptContent, modules: selectedModules },
      {
        onChunk: (chunk) => appendReport(chunk),
        onError: (msg) => { setError(msg); setIsAnalyzing(false); },
        onComplete: () => { setIsAnalyzing(false); setAnalysisDone(true); },
      },
      ctrl,
    );
  }, [isAnalyzing, scriptContent, selectedModules, setIsAnalyzing, appendReport, setError, reset]);

  /* ── 2. Regenerate with selected version ── */
  const handleRevise = useCallback(async () => {
    if (revising) return;
    setRevising(true);
    setRevised('');
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    analyzeScript(
      { scriptContent, modules: [solutionVersion], report },
      {
        onChunk: (chunk) => setRevised((p) => p + chunk),
        onError: (msg) => { setError(msg); setRevising(false); },
        onComplete: () => setRevising(false),
      },
      ctrl,
    );
  }, [revising, scriptContent, solutionVersion, report, setError]);

  const wordCount = scriptContent.length;

  return (
    <div className="mx-auto min-h-screen max-w-[960px] px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Script Doctor</h1>
        <p className="text-sm text-slate-400">剧本多维分析大师 · AI 驱动的专业剧本诊断</p>
      </header>

      {/* === INPUT SECTION === */}
      <div className="mb-4 flex rounded-lg bg-slate-100 p-1">
        <button onClick={() => setTab('file')} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${tab === 'file' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>上传文件</button>
        <button onClick={() => setTab('text')} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${tab === 'text' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>粘贴文本</button>
      </div>

      {tab === 'file' ? <DropZone onFileLoaded={setScriptContent} /> : <TextInput value={scriptContent} onChange={setScriptContent} />}

      {/* Module checkboxes */}
      <ModuleSelector selected={selectedModules} onToggle={toggleModule} disabled={isAnalyzing} />

      {/* Analyze button */}
      <button onClick={handleAnalyze} disabled={isAnalyzing || !scriptContent.trim()}
        className={`mt-4 flex w-full items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white ${isAnalyzing || !scriptContent.trim() ? 'cursor-not-allowed bg-indigo-300' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
        {isAnalyzing ? <><svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>分析中...</> : `开始分析（${wordCount.toLocaleString()} 字）`}
      </button>

      {/* Error */}
      {error && <ErrorAlert error={error} onRetry={handleAnalyze} onDismiss={() => setError(null)} />}

      {/* === REPORT SECTION (full width, below button) === */}
      {report && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-600">分析报告</h3>
            <div className="flex gap-2">
              <button onClick={() => downloadFile(report, '分析报告.txt', 'text/plain')} className="rounded border px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">导出 TXT</button>
            </div>
          </div>
          <ScoreCards scores={[]} />
          <div className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 max-h-[600px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{report}</div>
        </div>
      )}

      {/* === M15 VERSION SELECTOR (after analysis) === */}
      {analysisDone && (
        <div className="mt-6 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">选择修改方案版本（三选一）</h3>
          <div className="grid grid-cols-3 gap-3">
            {VERSIONS.map((v) => {
              const sel = solutionVersion === v.id;
              const c = VER_COLORS[v.color];
              return (
                <button key={v.id} onClick={() => setSolutionVersion(v.id)}
                  className={`flex flex-col items-center rounded-xl border-2 p-3 text-center transition-all ${sel ? `${c.border} ${c.bg} ${c.ring} ring-2` : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <span className="text-xl">{v.emoji}</span>
                  <span className={`mt-1 text-sm font-bold ${sel ? c.text : 'text-slate-700'}`}>{v.label}</span>
                  <span className="text-xs text-slate-500">{v.desc}</span>
                  <span className="text-[11px] text-slate-400">{v.sub}</span>
                  {sel && <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${c.dot}`}>✓ 已选</span>}
                </button>
              );
            })}
          </div>

          <button onClick={handleRevise} disabled={revising}
            className={`mt-4 flex w-full items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white ${revising ? 'cursor-not-allowed bg-green-300' : 'bg-green-500 hover:bg-green-600'}`}>
            {revising ? <><svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>生成中...</> : `生成${VERSIONS.find(v => v.id === solutionVersion)?.label || '标准版'}修改方案`}
          </button>

          {/* Revised output */}
          {revised && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50/20 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-green-700">优化后剧本</h3>
                <div className="flex gap-2">
                  <button onClick={() => exportTxt(revised)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-white">TXT</button>
                  <button onClick={() => exportDocx(revised)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-white">Word</button>
                  <button onClick={() => exportPdf(revised)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-white">PDF</button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none max-h-[500px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{revised}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
