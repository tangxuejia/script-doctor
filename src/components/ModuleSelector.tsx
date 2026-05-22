'use client';

import { useMemo } from 'react';
import { MODULES, ModuleMeta } from '@/store/modules';

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
  onSelectAll: (select: boolean) => void;
  onSelectPreset: (ids: string[]) => void;
}

type Preset = {
  label: string;
  ids: string[];
};

const PRESETS: Preset[] = [
  { label: '投稿过审', ids: ['M2', 'M14', 'M16', 'M17'] },
  { label: '深度诊断', ids: ['M1', 'M2', 'M3', 'M9', 'M14'] },
  { label: '出海评估', ids: ['M10', 'M14', 'M16'] },
  { label: '全部模块', ids: MODULES.map(m => m.id) },
];

export default function ModuleSelector({ selected, onToggle, disabled, onSelectAll, onSelectPreset }: Props) {
  const allSelected = selected.length === MODULES.length;
  const someSelected = selected.length > 0 && selected.length < MODULES.length;

  const activePreset = useMemo(() => {
    const sorted = [...selected].sort().join(',');
    for (const p of PRESETS) {
      if ([...p.ids].sort().join(',') === sorted) return p.label;
    }
    return null;
  }, [selected]);

  return (
    <div className="mt-1">
      {/* ── 全选 + 预设按钮 ── */}
      <div className="mb-3 space-y-2">
        {/* 全选 */}
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
          disabled ? 'cursor-not-allowed opacity-40' :
          allSelected ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
          'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
        }`}>
          <input type="checkbox" checked={allSelected} ref={el => el && (el.indeterminate = someSelected)}
            onChange={() => onSelectAll(!allSelected)} disabled={disabled} className="hidden" />
          <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-all ${
            allSelected ? 'border-emerald-500 bg-emerald-500' :
            someSelected ? 'border-amber-400 bg-amber-400' : 'border-gray-300'
          }`}>
            {allSelected && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            {someSelected && <span className="h-0.5 w-1.5 bg-white rounded-sm" />}
          </span>
          全选
        </label>

        {/* 预设按钮 */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const isActive = activePreset === p.label;
            return (
              <button key={p.label} onClick={() => onSelectPreset(p.ids)} disabled={disabled}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  disabled ? 'cursor-not-allowed opacity-30' :
                  isActive ? 'bg-indigo-500 text-white shadow-sm' :
                  'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 分隔线 ── */}
      <div className="mb-3 border-t border-gray-100" />

      {/* ── 计数 ── */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          已选 <span className="font-semibold text-gray-600">{selected.length}</span> / {MODULES.length} 项
        </span>
        {selected.length > 0 && (
          <button onClick={() => onSelectAll(false)} disabled={disabled}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">清空</button>
        )}
      </div>

      {/* ── 模块列表 ── */}
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
