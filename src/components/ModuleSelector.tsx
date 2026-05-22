'use client';

import { MODULES, ModuleMeta } from '@/store/modules';

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
}

export default function ModuleSelector({ selected, onToggle, disabled }: Props) {
  return (
    <div className="mt-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          已选 <span className="font-semibold text-gray-600">{selected.length}</span> / {MODULES.length} 项
        </span>
        {selected.length > 0 && (
          <button onClick={() => selected.forEach((m) => onToggle(m))} disabled={disabled}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">清空</button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
        {MODULES.map((m: ModuleMeta) => {
          const isSelected = selected.includes(m.id);
          return (
            <label key={m.id}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-all ${
                disabled ? 'cursor-not-allowed opacity-40' :
                isSelected ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200' :
                'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50'
              }`}>
              <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
              }`}>
                {isSelected && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
              </div>
              <input type="checkbox" checked={isSelected} onChange={() => onToggle(m.id)} disabled={disabled} className="hidden" />
              <div className="min-w-0">
                <span className={`text-xs font-semibold ${isSelected ? 'text-emerald-700' : 'text-gray-700'}`}>{m.name}</span>
                <p className="text-[11px] leading-tight text-gray-400 line-clamp-2 mt-0.5">{m.desc}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
