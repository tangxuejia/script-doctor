'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface Props {
  onFileLoaded: (content: string) => void;
}

export default function DropZone({ onFileLoaded }: Props) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onFileLoaded(reader.result as string);
      };
      reader.readAsText(file, 'utf-8');
    },
    [onFileLoaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer h-[420px] ${
        isDragActive
          ? 'border-indigo-400 bg-indigo-50'
          : 'border-slate-300 bg-slate-50 hover:border-slate-400'
      }`}
    >
      <input {...getInputProps()} />
      <svg className="mb-4 h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      {isDragActive ? (
        <p className="text-lg text-indigo-600 font-medium">释放文件以上传</p>
      ) : (
        <>
          <p className="text-lg text-slate-600 font-medium">
            拖拽剧本 .txt 文件到此处
          </p>
          <p className="mt-2 text-sm text-slate-400">或点击选择文件</p>
        </>
      )}
    </div>
  );
}
