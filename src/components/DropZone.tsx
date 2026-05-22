'use client';

import { useState, useRef, useEffect } from 'react';
import { readFileContent } from '@/lib/read-file';

interface Props {
  onFileLoaded: (content: string) => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function DropZone({ onFileLoaded }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onFileLoadedRef = useRef(onFileLoaded);
  useEffect(() => { onFileLoadedRef.current = onFileLoaded; });

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setStatus('loading');
    setErrorMsg('');
    try {
      const content = await readFileContent(file);
      onFileLoadedRef.current(content);
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg((err as Error).message || '文件读取失败');
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center cursor-pointer h-[420px] transition-colors ${
        status === 'success' ? 'border-green-300 bg-green-50' :
        status === 'error' ? 'border-red-300 bg-red-50' :
        dragOver ? 'border-indigo-400 bg-indigo-50' :
        'border-slate-300 bg-slate-50 hover:border-slate-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.doc,.docx,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />

      {status === 'loading' && (
        <svg className="mb-4 h-12 w-12 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {status === 'success' && (
        <svg className="mb-4 h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {status === 'error' && (
        <svg className="mb-4 h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {status === 'idle' && (
        <svg className="mb-4 h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      )}

      {status === 'loading' && <p className="text-indigo-500 font-medium">正在读取文件...</p>}
      {status === 'success' && <><p className="text-green-600 font-medium">已加载：{fileName}</p><button onClick={(e) => { e.stopPropagation(); setStatus('idle'); setFileName(''); }} className="mt-3 text-xs text-slate-400 hover:text-slate-600">重新选择</button></>}
      {status === 'error' && <p className="text-red-500 font-medium">{errorMsg}</p>}
      {status === 'idle' && <>
        <p className="text-slate-600 font-medium">{dragOver ? '释放文件以上传' : '拖拽文件到此处，或点击选择'}</p>
        <p className="mt-2 text-sm text-slate-400">支持 .txt / .docx / .pdf</p>
      </>}
    </div>
  );
}
