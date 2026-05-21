'use client';

import { useMemo, useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScoreItem, useScriptStore } from '@/store/useScriptStore';
import ScoreCards from './ScoreCards';

/** Parse key scores from markdown report text */
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

export default function ReportViewer() {
  const { report, isAnalyzing, setScores } = useScriptStore();
  const [copied, setCopied] = useState(false);

  // Parse scores whenever report updates (only when analysis finishes)
  const scores = useMemo(() => {
    if (!isAnalyzing && report) {
      const s = parseScores(report);
      if (s.length) setScores(s);
      return s;
    }
    return [];
  }, [report, isAnalyzing, setScores]);

  const copyReport = useCallback(async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-600">
          {isAnalyzing ? '分析中...' : '分析报告'}
        </h3>
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

      {/* Score cards */}
      <ScoreCards scores={scores} />

      {/* Report content */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5">
        {isAnalyzing && !report && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <span className="ml-3 text-sm text-slate-400">AI 正在分析...</span>
          </div>
        )}
        <div className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-700">
          <ReactMarkdown>{report}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
