'use client';

import { ScoreItem } from '@/store/useScriptStore';

interface Props {
  scores: ScoreItem[];
}

export default function ScoreCards({ scores }: Props) {
  if (!scores.length) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {scores.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center shadow-sm"
        >
          <div className="text-xs text-slate-400">{s.label}</div>
          <div className="text-lg font-bold text-indigo-600">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
