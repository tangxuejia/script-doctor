'use client';

import { useState, useRef } from 'react';
import { readFileContent } from '@/lib/read-file';

interface Props {
  onFileLoaded: (content: string) => void;
}

export default function DropZone({ onFileLoaded }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setStatus('loading');
    setErrorMsg('');
    try {
      const content = await readFileContent(file);
      // Both direct callback AND global event for redundancy
      onFileLoaded(content);
      window.dispatchEvent(new CustomEvent('script:loaded', { detail: content }));
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg((err as Error).message || '文件读取失败');
    }
  };

  const baseStyle = "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer h-[380px] transition-all duration-300";

  const statusStyles: Record<string, string> = {
    idle: dragOver ? 'border-emerald-400 bg-emerald-50/50 scale-[1.01]' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50',
    loading: 'border-emerald-300 bg-emerald-50',
    success: 'border-emerald-300 bg-emerald-50/50',
    error: 'border-red-200 bg-red-50',
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      onClick={() => inputRef.current?.click()}
      className={`${baseStyle} ${statusStyles[status]}`}
    >
      <input ref={inputRef} type="file" accept=".txt,.doc,.docx,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); if (inputRef.current) inputRef.current.value = ''; }} />

      {/* Status icons */}
      {status === 'loading' && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><svg className="h-7 w-7 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>}
      {status === 'success' && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></div>}
      {status === 'error' && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100"><svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>}
      {status === 'idle' && <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full transition-colors ${dragOver ? 'bg-emerald-100' : 'bg-gray-100'}`}>
        <svg className={`h-7 w-7 transition-colors ${dragOver ? 'text-emerald-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
        </svg>
      </div>}

      {status === 'loading' && <p className="font-medium text-emerald-600">正在解析文件...</p>}
      {status === 'success' && <>
        <p className="font-medium text-emerald-700">已解析：<span className="text-gray-700">{fileName}</span></p>
        <button onClick={(e) => { e.stopPropagation(); setStatus('idle'); setFileName(''); }}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">点击重新选择</button>
      </>}
      {status === 'error' && <p className="font-medium text-red-500">{errorMsg}</p>}
      {status === 'idle' && <>
        <p className="font-medium text-gray-600">{dragOver ? '释放文件以上传' : '拖拽文件到此处，或点击上传'}</p>
        <p className="mt-2 text-sm text-gray-400">支持 .txt · .docx · .pdf</p>
      </>}
    </div>
  );
}
