'use client';

import { useState, useCallback, useRef } from 'react';
import { useScriptStore, SolutionVersion } from '@/store/useScriptStore';
import { analyzeScript } from '@/lib/analyze-client';
import DropZone from '@/components/DropZone';
import TextInput from '@/components/TextInput';
import ModuleSelector from '@/components/ModuleSelector';
import ReportViewer from '@/components/ReportViewer';
import ErrorAlert from '@/components/ErrorAlert';

type InputTab = 'file' | 'text';

export default function Home() {
  const {
    scriptContent,
    selectedModules,
    isAnalyzing,
    error,
    solutionVersion,
    setScriptContent,
    toggleModule,
    setIsAnalyzing,
    appendReport,
    setError,
    setSolutionVersion,
    reset,
  } = useScriptStore();

  const [tab, setTab] = useState<InputTab>('file');
  const abortRef = useRef<AbortController | null>(null);

  const wordCount = scriptContent.length;

  const handleFileLoaded = useCallback(
    (content: string) => {
      setScriptContent(content);
    },
    [setScriptContent],
  );

  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing) return;
    if (!scriptContent.trim()) {
      setError('请先输入剧本内容');
      return;
    }
    if (scriptContent.length < 100) {
      setError(`剧本内容至少需要 100 字（当前 ${scriptContent.length} 字）`);
      return;
    }

    reset();
    setIsAnalyzing(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    analyzeScript(
      { scriptContent, modules: [...selectedModules, solutionVersion] },
      {
        onChunk: (chunk) => appendReport(chunk),
        onError: (errMsg) => {
          setError(errMsg);
          setIsAnalyzing(false);
        },
        onComplete: () => {
          setIsAnalyzing(false);
        },
      },
      controller,
    );
  }, [
    isAnalyzing,
    scriptContent,
    selectedModules,
    solutionVersion,
    setIsAnalyzing,
    appendReport,
    setError,
    reset,
  ]);

  const handleRetry = useCallback(() => {
    setError(null);
    handleAnalyze();
  }, [handleAnalyze, setError]);

  return (
    <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col px-4 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Script Doctor</h1>
          <p className="text-sm text-slate-400">剧本多维分析大师 · AI 驱动的专业剧本诊断</p>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 gap-6">
        {/* Left: Input area */}
        <div className="flex w-[60%] flex-col">
          {/* Tab switcher */}
          <div className="mb-3 flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setTab('file')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'file'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              上传文件
            </button>
            <button
              onClick={() => setTab('text')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'text'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              粘贴文本
            </button>
          </div>

          {/* Input area */}
          {tab === 'file' ? (
            <DropZone onFileLoaded={handleFileLoaded} />
          ) : (
            <TextInput value={scriptContent} onChange={setScriptContent} />
          )}

          {/* Module selector */}
          <ModuleSelector
            selected={selectedModules}
            onToggle={toggleModule}
            disabled={isAnalyzing}
          />

          {/* Solution version selector */}
          <div className="mt-4 border-t border-slate-200 pt-4">
            <span className="text-sm font-medium text-slate-600">
              选择修改方案版本（三选一）
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([
                { id: 'M15_STANDARD' as SolutionVersion, label: '标准版', desc: '对白打磨 + 细节优化 + 钩子强化，不改结构', color: 'orange', icon: '' },
                { id: 'M15_DEEP' as SolutionVersion, label: '深度版', desc: '结构调整 + 人物深化 + 新增场景', color: 'blue', icon: '' },
                { id: 'M15_REMAKE' as SolutionVersion, label: '重塑版', desc: '立意升级 + 人物关系重构 + 叙事结构重塑', color: 'amber', icon: '🏆' },
              ] as const).map((v) => {
                const selected = solutionVersion === v.id;
                const colors: Record<string, { border: string; bg: string; badge: string; text: string }> = {
                  orange: { border: 'border-orange-400', bg: 'bg-orange-50', badge: 'bg-orange-500', text: 'text-orange-600' },
                  blue: { border: 'border-blue-400', bg: 'bg-blue-50', badge: 'bg-blue-500', text: 'text-blue-600' },
                  amber: { border: 'border-amber-400', bg: 'bg-amber-50', badge: 'bg-amber-500', text: 'text-amber-600' },
                };
                const c = colors[v.color];
                return (
                  <button
                    key={v.id}
                    onClick={() => setSolutionVersion(v.id)}
                    disabled={isAnalyzing}
                    className={`flex flex-col items-center rounded-lg border-2 p-2.5 text-left transition-all disabled:opacity-50 ${
                      selected
                        ? `${c.border} ${c.bg}`
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {v.icon && <span className="text-sm">{v.icon}</span>}
                      <span className={`text-xs font-semibold ${selected ? c.text : 'text-slate-600'}`}>
                        {v.label}
                      </span>
                      {selected && (
                        <div className={`ml-auto h-3 w-3 rounded-full ${c.badge}`} />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-tight text-slate-400">
                      {v.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !scriptContent.trim()}
            className={`mt-4 flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all ${
              isAnalyzing || !scriptContent.trim()
                ? 'cursor-not-allowed bg-indigo-300'
                : 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700'
            }`}
          >
            {isAnalyzing ? (
              <>
                <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                分析中...
              </>
            ) : (
              `开始分析（${wordCount.toLocaleString()} 字）`
            )}
          </button>

          {/* Error */}
          {error && <ErrorAlert error={error} onRetry={handleRetry} onDismiss={() => setError(null)} />}
        </div>

        {/* Right: Report area */}
        <div className="flex w-[40%] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
          <ReportViewer />
        </div>
      </div>
    </div>
  );
}
