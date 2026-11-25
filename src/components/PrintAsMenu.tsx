import { ChevronDown, Eye, FileText, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface PrintAsMenuProps {
  onPrintPaperOrPdf: () => void;
  onExportPdf?: () => Promise<void> | void;
  onExportWord?: () => Promise<void> | void;
  onPreviewPrint?: () => void;
  compact?: boolean;
}

export function PrintAsMenu({
  onPrintPaperOrPdf,
  onExportPdf,
  onExportWord,
  onPreviewPrint,
  compact = false,
}: PrintAsMenuProps) {
  const [open, setOpen] = useState(false);
  const [busyWord, setBusyWord] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Keep onExportPdf available via preview modal / fallback if no preview handler
  const handleMergedPrintAndPdf = async () => {
    setOpen(false);
    onPrintPaperOrPdf();
    if (!onPreviewPrint && onExportPdf) {
      await onExportPdf();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
        }
      >
        <Printer className="w-3.5 h-3.5 text-slate-500" />
        <span>طباعة كـ</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-40 py-1.5 text-right">
          {/* 1. طباعة (A4 + PDF منسق) */}
          <button
            type="button"
            onClick={() => void handleMergedPrintAndPdf()}
            className="w-full text-right px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
          >
            <Printer className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
            <span>طباعة (A4 / PDF منسق)</span>
          </button>

          {/* 2. طباعة وورد */}
          {onExportWord && (
            <button
              type="button"
              disabled={busyWord}
              onClick={async () => {
                setOpen(false);
                setBusyWord(true);
                try {
                  await onExportWord();
                } finally {
                  setBusyWord(false);
                }
              }}
              className="w-full text-right px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 disabled:opacity-60"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>طباعة وورد (.docx)</span>
            </button>
          )}

          {/* 3. طباعة ومعاينة وورد / A4 */}
          {onPreviewPrint && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onPreviewPrint();
              }}
              className="w-full text-right px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
              <span>طباعة ومعاينة وورد</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
