'use client';

import { useState, useCallback, useRef } from 'react';
import { useScriptStore } from '@/store/useScriptStore';
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
    setScriptContent,
    toggleModule,
    setIsAnalyzing,
    appendReport,
    setError,
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
      { scriptContent, modules: selectedModules },
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
