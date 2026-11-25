import { useState } from 'react';
import { AlertTriangle, Download, Sparkles, Trash2, X } from 'lucide-react';
import { downloadWorkspaceBackupJson } from '../lib/localWorkspaceService';
import type { WorkspaceState } from '../types';

interface ClearWorkspaceModalProps {
  open: boolean;
  workspace: WorkspaceState;
  onClose: () => void;
  onConfirmClear: () => Promise<void>;
  onCleanNonEssential?: () => Promise<void>;
  onToast: (msg: string) => void;
}

export function ClearWorkspaceModal({
  open,
  workspace,
  onClose,
  onConfirmClear,
  onCleanNonEssential,
  onToast,
}: ClearWorkspaceModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  const handleDownloadDb = (labelPrefix: string) => {
    downloadWorkspaceBackupJson(workspace, labelPrefix);
    onToast('تم تحميل نسخة قاعدة البيانات بنجاح');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/50"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="font-display text-base font-bold">
              {step === 1
                ? 'حمل قاعدة البيانات — تأكيد قبل التفريغ (1 من 2)'
                : 'تكرار مع تحيات أحمد — التأكيد النهائي (2 من 2)'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-right">
          {step === 1 ? (
            <>
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 space-y-2">
                <p className="text-sm font-bold text-amber-950 dark:text-amber-200">
                  حمل قاعدة البيانات
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  يُرجى تحميل نسخة احتياطية من قاعدة البيانات قبل تفريغ الملفات للحفاظ على جميع أعمالك ومستنداتك.
                </p>
                <p className="text-xs font-extrabold text-blue-700 dark:text-blue-400 pt-1">
                  مع تحيات أحمد
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadDb('حمل_قاعدة_البيانات')}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                حمل قاعدة البيانات (.json)
              </button>

              {onCleanNonEssential && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onCleanNonEssential();
                      handleClose();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-100"
                >
                  <Sparkles className="w-4 h-4" />
                  تنظيف البيانات التجريبية وغير اللازمة فقط (للتطوير)
                </button>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                >
                  متابعة للتأكيد الثاني
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 space-y-2">
                <p className="text-sm font-bold text-red-900 dark:text-red-200">
                  حمل قاعدة البيانات — تأكيد نهائي
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  هل قمت بتحميل قاعدة البيانات؟ بالضغط على «تأكيد التفريغ النهائي» سيتم مسح جميع الملفات والمذكرات والمراسلات الحالية من قاعدة البيانات.
                </p>
                <p className="text-xs font-extrabold text-red-800 dark:text-red-300 pt-1">
                  تكرار مع تحيات أحمد
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadDb('تكرار_حمل_قاعدة_البيانات')}
                className="w-full py-2.5 px-4 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                حمل قاعدة البيانات مرة أخرى
              </button>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  رجوع
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onConfirmClear();
                      onToast('تم تفريغ الملفات وقاعدة البيانات بنجاح');
                      handleClose();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {busy ? 'جاري التفريغ...' : 'تأكيد التفريغ النهائي'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
