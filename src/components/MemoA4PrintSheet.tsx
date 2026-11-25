import { Download, FileText, Printer, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDateAr, generateWordDocxBlob } from '../lib/fileParser';
import { downloadMemoPdf } from '../lib/pdfExporter';
import type { ItemDomain, MemoDirection } from '../types';

export interface PrintableMemoData {
  headerMode?: 'memo' | 'draft';
  title: string;
  content: string;
  domain: ItemDomain;
  direction?: MemoDirection;
  departmentName?: string;
  projectName?: string;
  refNumber?: string;
  updatedAt?: string;
  linkedFileNames?: string[];
}

function isPrintSubheadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90) return false;
  if (/^[-•*]\s+/.test(trimmed)) return false;
  return (
    trimmed.endsWith(':') ||
    trimmed.endsWith('：') ||
    /^(\d+[\.\-\)]|أولاً|ثانياً|ثالثاً|رابعاً|خامساً|سادساً|الموضوع|الملخص|التوصيات|النتائج|الملاحظات|القرار|المطلوب|أبرز المهام)/i.test(
      trimmed
    )
  );
}

function MemoSheetContent({ memo }: { memo: PrintableMemoData }) {
  const isDraft = memo.headerMode === 'draft';
  const accentBarClass = isDraft ? 'bg-emerald-700' : 'bg-blue-700';
  const accentTextClass = isDraft ? 'text-emerald-700' : 'text-blue-700';
  const accentBoxClass = isDraft
    ? 'bg-emerald-50/80 border-emerald-200 border-r-emerald-700 border-l-emerald-700'
    : 'bg-blue-50/80 border-blue-200 border-r-blue-700 border-l-blue-700';
  const subheadClass = isDraft
    ? 'text-emerald-900 border-emerald-200'
    : 'text-blue-900 border-slate-200';
  const metaAccentClass = isDraft
    ? 'border-r-4 border-r-emerald-700'
    : 'border-r-4 border-r-blue-700';

  const lines = (memo.content || '').split(/\r?\n/);

  return (
    <div
      className="bg-white text-slate-900 border-2 border-slate-900 p-1.5 shadow-sm"
      dir="rtl"
    >
      <div className="border border-slate-300 flex flex-col min-h-[258mm]">
        {/* Top Executive Accent Strip */}
        <div className={`h-2 w-full ${accentBarClass}`} />

        <div className="p-6 sm:p-8 flex-1 flex flex-col">
          {/* Top Company & Directorate Header + Metadata Card */}
          <div
            className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 ${
              isDraft ? 'border-emerald-700' : 'border-blue-700'
            }`}
          >
            <div className="text-right space-y-1">
              <div className="font-display text-xl font-extrabold text-slate-950 tracking-tight">
                شركة الدقهلية لصناعة وتكرير السكر
              </div>
              <div className={`font-display text-sm font-bold ${accentTextClass}`}>
                {isDraft
                  ? 'إدارة البيئة — مسودة عمل'
                  : 'الإدارة العامة للبيئة والسلامة المهنية'}
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                مكتب المدير العام
              </div>
            </div>

            <div
              className={`min-w-[215px] rounded-lg bg-slate-50 border border-slate-300 ${metaAccentClass} px-3.5 py-2.5 text-xs space-y-1 text-right`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-600">التاريخ:</span>
                <span className="font-semibold text-slate-900">
                  {formatDateAr(memo.updatedAt || new Date().toISOString())}
                </span>
              </div>
              {(isDraft || memo.direction) && (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-600">التصنيف:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-display font-bold text-[11px] ${
                      isDraft
                        ? 'bg-emerald-100 text-emerald-800'
                        : memo.direction === 'incoming'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isDraft
                      ? 'مسودة عمل'
                      : memo.direction === 'incoming'
                        ? 'وارد'
                        : 'صادر'}
                  </span>
                </div>
              )}
              {memo.departmentName && (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-600 shrink-0">الجهة:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[165px]">
                    {memo.departmentName}
                  </span>
                </div>
              )}
              {memo.refNumber && (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-600">المرجع:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {memo.refNumber}
                  </span>
                </div>
              )}
              {memo.projectName && (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-600">المجلد:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[165px]">
                    {memo.projectName}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="h-[1px] bg-slate-200 mt-1 mb-5" />

          {/* Title Banner */}
          <div
            className={`rounded-lg border border-r-4 border-l-4 px-5 py-3 mb-6 text-center ${accentBoxClass}`}
          >
            <h1 className="font-display text-xl font-extrabold text-slate-950 leading-snug">
              {memo.title || (isDraft ? 'مسودة عمل' : 'مذكرة عمل')}
            </h1>
          </div>

          {/* Formatted Body Content */}
          <div className="flex-1 text-[13.5px] leading-[1.95] text-slate-800 space-y-2">
            {lines.map((rawLine, idx) => {
              const trimmed = rawLine.trim();
              if (!trimmed) {
                return <div key={idx} className="h-2.5" />;
              }
              if (isPrintSubheadingLine(trimmed)) {
                return (
                  <h2
                    key={idx}
                    className={`font-display text-[15px] font-bold pt-2 pb-1 border-b ${subheadClass}`}
                  >
                    {trimmed}
                  </h2>
                );
              }
              if (/^[-•*]\s+/.test(trimmed)) {
                return (
                  <div key={idx} className="flex items-start gap-2 pr-3">
                    <span className={`font-bold ${accentTextClass}`}>•</span>
                    <span>{trimmed.replace(/^[-•*]\s+/, '')}</span>
                  </div>
                );
              }
              return <p key={idx}>{trimmed}</p>;
            })}
          </div>

          {/* Attachments Box */}
          {memo.linkedFileNames && memo.linkedFileNames.length > 0 && (
            <div className="mt-6 p-3.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-700">
              <p className="font-display font-bold text-slate-900 mb-1.5">
                المرفقات والملفات المرتبطة ({memo.linkedFileNames.length}):
              </p>
              <ul className="list-disc pr-5 space-y-0.5">
                {memo.linkedFileNames.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Official Footer */}
          <div className="mt-8 pt-3.5 border-t border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
            <span>إدارة البيئة والسلامة المهنية — السكرتارية</span>
            <span>د. أيمن عبد الحميد — مدير عام البيئة والسلامة المهنية</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MemoA4PrintSheet({ memo }: { memo: PrintableMemoData | null }) {
  if (!memo || typeof document === 'undefined') return null;

  return createPortal(
    <div className="print-only-memo bg-white text-slate-900 p-2" dir="rtl">
      <MemoSheetContent memo={memo} />
    </div>,
    document.body
  );
}

interface MemoPrintPreviewModalProps {
  memo: PrintableMemoData | null;
  open: boolean;
  sandboxNotice?: boolean;
  onClose: () => void;
  onTriggerNativePrint: () => void;
  onToast?: (msg: string) => void;
}

export function MemoPrintPreviewModal({
  memo,
  open,
  sandboxNotice = false,
  onClose,
  onTriggerNativePrint,
  onToast,
}: MemoPrintPreviewModalProps) {
  const [busyPdf, setBusyPdf] = useState(false);
  const [busyWord, setBusyWord] = useState(false);

  if (!open || !memo) return null;

  const handleDirectPdf = async () => {
    setBusyPdf(true);
    try {
      await downloadMemoPdf(memo);
      onToast?.('تم تحميل ملف PDF المنسق بإطار وتنسيق التطبيق');
    } catch {
      onToast?.('تعذر إنشاء ملف PDF، جرّب طباعة الصفحة أو تصدير Word');
    } finally {
      setBusyPdf(false);
    }
  };

  const handleDirectWord = async () => {
    setBusyWord(true);
    try {
      const blob = await generateWordDocxBlob({
        title: memo.title,
        departmentName: memo.departmentName,
        refNumber: memo.refNumber,
        bodyText: memo.content,
        headerMode: memo.headerMode,
        direction: memo.direction,
        projectName: memo.projectName,
        updatedAt: memo.updatedAt,
        linkedFileNames: memo.linkedFileNames,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(memo.title || 'مذكرة').slice(0, 45)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      onToast?.('تم تصدير ملف Word (.docx) بنفس تنسيق وإطار التطبيق');
    } finally {
      setBusyWord(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-4xl max-h-[92vh] bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Action Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-extrabold text-slate-950 dark:text-white truncate">
              معاينة صفحة الطباعة والتصدير (A4)
            </h2>
            {sandboxNotice && (
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-0.5">
                نافذة المعاينة مفعلة — يمكنك تنزيل ملف PDF مباشرة أو استخدام الطباعة على الطابعة.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTriggerNativePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة على الطابعة</span>
            </button>

            <button
              type="button"
              disabled={busyPdf}
              onClick={() => void handleDirectPdf()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{busyPdf ? 'جاري التجهيز...' : 'تحميل ملف PDF (.pdf)'}</span>
            </button>

            <button
              type="button"
              disabled={busyWord}
              onClick={() => void handleDirectWord()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs disabled:opacity-60"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{busyWord ? 'جاري التجهيز...' : 'تصدير Word (.docx)'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
              aria-label="إغلاق المعاينة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Preview Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/80 dark:bg-slate-950/80">
          <div className="max-w-[210mm] mx-auto shadow-xl">
            <MemoSheetContent memo={memo} />
          </div>
        </div>
      </div>
    </div>
  );
}
