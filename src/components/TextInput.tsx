'use client';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function TextInput({ value, onChange }: Props) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="在此粘贴剧本内容..."
        className="h-[420px] w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      <div className="absolute bottom-3 right-3 rounded-md bg-white/80 px-2 py-1 text-xs text-slate-400 backdrop-blur">
        {value.length.toLocaleString()} 字
      </div>
    </div>
  );
}
