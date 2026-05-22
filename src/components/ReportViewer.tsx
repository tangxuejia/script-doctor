'use client';

import { useMemo, useCallback, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScoreItem, useScriptStore } from '@/store/useScriptStore';
import ScoreCards from './ScoreCards';

/* ── Score parsing ── */
function parseScores(text: string): ScoreItem[] {
  const patterns: { label: string; regex: RegExp }[] = [
    { label: '专业评分', regex: /\*\*专业评分\*\*[：:]\s*(.+)/ },
    { label: '市场潜力', regex: /\*\*市场潜力\*\*[：:]\s*(.+)/ },
    { label: '合规风险', regex: /\*\*合规风险\*\*[：:]\s*(.+)/ },
    { label: '投流适配', regex: /\*\*投流适配度\*\*[：:]\s*(.+)/ },
    { label: 'AI痕迹', regex: /\*\*AI痕迹等级\*\*[：:]\s*(.+)/ },
    { label: '人本情感', regex: /\*\*人本情感指数\*\*[：:]\s*(.+)/ },
    { label: '专家推荐', regex: /\*\*专家推荐度\*\*[：:]\s*(.+)/ },
  ];
  const scores: ScoreItem[] = [];
  for (const p of patterns) {
    const m = text.match(p.regex);
    if (m?.[1]) scores.push({ label: p.label, value: m[1].trim() });
  }
  return scores;
}

/* ── Split report into diagnostic and solutions sections ── */
function splitReport(text: string): { diagnostic: string; solutions: string; hasSolutions: boolean } {
  const idx = text.indexOf('剧本修改解决方案');
  if (idx === -1) return { diagnostic: text, solutions: '', hasSolutions: false };

  // Find the heading line that contains this
  const before = text.slice(0, idx);
  const solutions = text.slice(idx);

  return { diagnostic: before, solutions, hasSolutions: true };
}

/* ── Extract comparison blocks from solutions text ── */
interface CompareBlock {
  original: string;
  modified: string;
  label: string;
}

function extractComparisons(text: string): { cleaned: string; comparisons: CompareBlock[] } {
  const comparisons: CompareBlock[] = [];
  // Match lines with 原内容/原文 followed by 修改后/建议修改 within the next few lines
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const origMatch = line.match(/^(?:原内容|原文)[：:]\s*(.+)/);
    if (origMatch) {
      const original = origMatch[1];
      // Look for the next "修改后" line
      let j = i + 1;
      while (j < lines.length && j < i + 15) {
        const modMatch = lines[j].trim().match(/^(?:修改后|建议修改|建议)[：:]\s*(.+)/);
        if (modMatch) {
          comparisons.push({
            original,
            modified: modMatch[1],
            label: `修改 ${comparisons.length + 1}`,
          });
          break;
        }
        j++;
      }
    }
    i++;
  }

  return { cleaned: text, comparisons };
}

/* ── ReportViewer ── */
export default function ReportViewer() {
  const { report, isAnalyzing, setScores, solutionVersion } = useScriptStore();
  const [copied, setCopied] = useState(false);
  const solutionsRef = useRef<HTMLDivElement>(null);

  // Parse scores when analysis finishes
  useMemo(() => {
    if (!isAnalyzing && report) {
      const s = parseScores(report);
      if (s.length) setScores(s);
    }
  }, [report, isAnalyzing, setScores]);

  const { diagnostic, solutions, hasSolutions } = useMemo(
    () => splitReport(report),
    [report],
  );

  const { comparisons } = useMemo(
    () => (solutions ? extractComparisons(solutions) : { cleaned: solutions, comparisons: [] as CompareBlock[] }),
    [solutions],
  );

  const displayScores = useMemo(() => parseScores(report), [report]);

  const copyReport = useCallback(async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied, 2000);
  }, [report]);

  const printReport = useCallback(() => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><meta charset="utf-8"><title>剧本分析报告</title>
      <style>body{font-family:system-ui,sans-serif;max-width:800px;margin:auto;padding:2rem;line-height:1.8}</style></head>
      <body>${report || ''}</body></html>
    `);
    win.document.close();
    win.print();
  }, [report]);

  const scrollToSolutions = () => {
    solutionsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ── Empty state ── */
  if (!report && !isAnalyzing) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-400">
        <svg className="mb-3 h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-sm">在左侧输入剧本内容，选择分析模块后开始分析</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* ▸ Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-slate-600">
            {isAnalyzing ? '分析中...' : '分析报告'}
          </h3>
          {hasSolutions && (
            <button
              onClick={scrollToSolutions}
              className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200 transition-colors"
            >
              查看解决方案 ↓
            </button>
          )}
        </div>
        {report && !isAnalyzing && (
          <div className="flex gap-2">
            <button
              onClick={copyReport}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              {copied ? '已复制' : '复制报告'}
            </button>
            <button
              onClick={printReport}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              导出 PDF
            </button>
          </div>
        )}
      </div>

      {/* ▸ Score cards */}
      <ScoreCards scores={displayScores} />

      {/* ▸ Report content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading spinner */}
        {isAnalyzing && !report && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <span className="ml-3 text-sm text-slate-400">AI 正在分析...</span>
          </div>
        )}

        {/* Diagnostic part */}
        {diagnostic && (
          <div className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-700 rounded-xl border border-slate-200 bg-white p-5">
            <ReactMarkdown>{diagnostic}</ReactMarkdown>
          </div>
        )}

        {/* Solutions part (highlighted) */}
        {hasSolutions && (() => {
          // Version color scheme
          const verColors: Record<string, { border: string; bg: string; badge: string; heading: string; label: string }> = {
            'M15_STANDARD': { border: 'border-orange-300', bg: 'bg-orange-50/30', badge: 'bg-orange-500 text-white', heading: 'text-orange-700', label: '🏗️ 标准版修改方案' },
            'M15_DEEP':    { border: 'border-blue-300',  bg: 'bg-blue-50/30',  badge: 'bg-blue-500 text-white',  heading: 'text-blue-700',  label: '🔧 深度版修改方案' },
            'M15_REMAKE':  { border: 'border-amber-300', bg: 'bg-amber-50/30', badge: 'bg-amber-500 text-white', heading: 'text-amber-700', label: '🏆 精品重塑方案' },
          };
          const vc = verColors[solutionVersion] || verColors['M15_STANDARD'];

          return (
          <>
            <div ref={solutionsRef} />

            {/* Version badge */}
            <div className={`mt-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${vc.badge}`}>
              {vc.label}
            </div>

            {/* Comparison cards summary */}
            {comparisons.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-3">
                {comparisons.map((cmp, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                      修改对比 {i + 1}
                    </div>
                    <div className="flex divide-x divide-slate-200">
                      <div className="w-1/2 border-l-4 border-red-300 p-3">
                        <div className="mb-1 text-[11px] font-medium text-red-400 uppercase tracking-wide">原内容</div>
                        <div className="text-sm leading-relaxed text-slate-600">{cmp.original}</div>
                      </div>
                      <div className="w-1/2 border-l-4 border-green-400 p-3">
                        <div className="mb-1 text-[11px] font-medium text-green-500 uppercase tracking-wide">修改后</div>
                        <div className="text-sm leading-relaxed text-slate-600">{cmp.modified}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Full solutions markdown with version-colored background */}
            <div className={`mt-4 rounded-xl border-2 ${vc.border} ${vc.bg} p-5`}>
              <div className={`prose prose-sm max-w-none prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-700
                ${solutionVersion === 'M15_DEEP' ? '[&_h2]:text-blue-700 [&_h3]:text-blue-700' :
                  solutionVersion === 'M15_REMAKE' ? '[&_h2]:text-amber-600 [&_h3]:text-amber-600' :
                  '[&_h2]:text-orange-600 [&_h3]:text-orange-600'}`}>
                <ReactMarkdown>{solutions}</ReactMarkdown>
              </div>
            </div>
          </>
          );
        })()}
      </div>
    </div>
  );
}
