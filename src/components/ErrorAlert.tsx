'use client';

interface Props {
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export default function ErrorAlert({ error, onRetry, onDismiss }: Props) {
  const is429 = error.includes('429') || error.includes('用完');

  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-700">
            {is429 ? '今日免费次数已用完' : '分析失败'}
          </p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          {is429 && (
            <p className="mt-1 text-xs text-red-400">
              请明天再试，或升级至 Premium 会员享受每日 999 次分析
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!is429 && (
            <button
              onClick={onRetry}
              className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
            >
              重试
            </button>
          )}
          <button
            onClick={onDismiss}
            className="rounded-md px-2 py-1 text-xs text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
