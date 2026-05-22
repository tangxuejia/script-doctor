'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { readFileContent } from '@/lib/read-file';

interface Props {
  onFileLoaded: (content: string) => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function DropZone({ onFileLoaded }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setFileName(file.name);
      setStatus('loading');
      setErrorMsg('');

      try {
        const content = await readFileContent(file);
        onFileLoaded(content);
        setStatus('success');
      } catch (err: unknown) {
        setStatus('error');
        setErrorMsg((err as Error).message || '文件读取失败');
      }
    },
    [onFileLoaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  });

  const statusIcon = () => {
    switch (status) {
      case 'loading':
        return (
          <svg className="h-12 w-12 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        );
    }
  };

  const statusMessage = () => {
    switch (status) {
      case 'loading':
        return <p className="text-indigo-500 font-medium">正在读取文件...</p>;
      case 'success':
        return <p className="text-green-600 font-medium">已加载：{fileName}</p>;
      case 'error':
        return <p className="text-red-500 font-medium">{errorMsg}</p>;
      default:
        return isDragActive ? (
          <p className="text-indigo-600 font-medium">释放文件以上传</p>
        ) : (
          <>
            <p className="text-slate-600 font-medium">拖拽文件到此处，或点击选择</p>
            <p className="mt-2 text-sm text-slate-400">支持 .txt / .docx / .pdf</p>
          </>
        );
    }
  };

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer h-[420px] ${
        status === 'success'
          ? 'border-green-300 bg-green-50'
          : status === 'error'
            ? 'border-red-300 bg-red-50'
            : isDragActive
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400'
      }`}
    >
      <input {...getInputProps()} />
      <div className="mb-4">{statusIcon()}</div>
      {statusMessage()}
      {status === 'success' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setStatus('idle');
            setFileName('');
          }}
          className="mt-3 text-xs text-slate-400 hover:text-slate-600"
        >
          重新选择文件
        </button>
      )}
    </div>
  );
}
