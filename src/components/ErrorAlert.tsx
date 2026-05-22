'use client';

interface Props { error: string; onRetry: () => void; onDismiss: () => void; }

export default function ErrorAlert({ error, onRetry, onDismiss }: Props) {
  const is429 = error.includes('429') || error.includes('用完');
  return (
    <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
          <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">{is429 ? '今日免费次数已用完' : '分析失败'}</p>
          <p className="mt-0.5 text-sm text-red-500">{error}</p>
          {is429 && <p className="mt-1 text-xs text-red-400">请明天再试，或升级 Premium 会员享受每日 999 次分析</p>}
        </div>
        <div className="flex gap-2">
          {!is429 && <button onClick={onRetry} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors">重试</button>}
          <button onClick={onDismiss} className="rounded-lg px-2 py-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">✕</button>
        </div>
      </div>
    </div>
  );
}
