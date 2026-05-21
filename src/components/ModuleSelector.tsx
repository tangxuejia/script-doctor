'use client';

import { MODULES, ModuleMeta } from '@/store/modules';

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
}

export default function ModuleSelector({ selected, onToggle, disabled }: Props) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">
          分析模块
          {selected.length > 0 && (
            <span className="ml-1 text-indigo-500">({selected.length})</span>
          )}
        </span>
        {selected.length > 0 && (
          <button
            onClick={() => selected.forEach((m) => onToggle(m))}
            disabled={disabled}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            清空
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
        {MODULES.map((m: ModuleMeta) => {
          const isSelected = selected.includes(m.id);
          return (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-all text-left ${
                disabled
                  ? 'cursor-not-allowed opacity-50'
                  : isSelected
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(m.id)}
                disabled={disabled}
                className="mt-0.5 h-3.5 w-3.5 accent-indigo-500"
              />
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-700">{m.name}</span>
                <p className="text-[11px] leading-tight text-slate-400 line-clamp-2">
                  {m.desc}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
