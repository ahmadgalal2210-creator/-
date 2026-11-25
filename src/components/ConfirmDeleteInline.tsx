import { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';

interface ConfirmDeleteInlineProps {
  onConfirm: () => Promise<void> | void;
  label?: string;
  compact?: boolean;
}

export function ConfirmDeleteInline({
  onConfirm,
  label = 'حذف',
  compact = false,
}: ConfirmDeleteInlineProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirming) {
    return (
      <div
        className="inline-flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={busy}
          onClick={async (e) => {
            e.stopPropagation();
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              setConfirming(false);
            }
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white text-[11px] font-bold hover:bg-red-700"
        >
          <Check className="w-3 h-3" />
          تأكيد
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }}
          className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="إلغاء الحذف"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      title={label}
      aria-label={label}
      className={
        compact
          ? 'p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
          : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40'
      }
    >
      <Trash2 className={compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
