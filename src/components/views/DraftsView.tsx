import { FileEdit, Plus } from 'lucide-react';
import { formatDateAr, generateWordDocxBlob } from '../../lib/fileParser';
import { downloadMemoPdf } from '../../lib/pdfExporter';
import type { DraftScope, InspectedItem, WorkDraft } from '../../types';
import { ConfirmDeleteInline } from '../ConfirmDeleteInline';
import type { PrintableMemoData } from '../MemoA4PrintSheet';
import { PrintAsMenu } from '../PrintAsMenu';

interface DraftsViewProps {
  drafts: WorkDraft[];
  scopeFilter: 'all' | DraftScope;
  onChangeScopeFilter: (scope: 'all' | DraftScope) => void;
  onAddDraft: (scope: DraftScope) => void;
  onDeleteDraft: (id: string) => Promise<void>;
  onInspect: (item: InspectedItem) => void;
  onPrintMemo: (data: PrintableMemoData, options?: { previewOnly?: boolean }) => void;
}

export function DraftsView({
  drafts,
  scopeFilter,
  onChangeScopeFilter,
  onAddDraft,
  onDeleteDraft,
  onInspect,
  onPrintMemo,
}: DraftsViewProps) {
  const filtered = drafts.filter((d) => {
    if (scopeFilter === 'all') return true;
    return (d.scope || 'factory') === scopeFilter;
  });

  return (
    <div className="space-y-5">
      {/* Scope Filter Bar & Add Draft */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeScopeFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border ${
              scopeFilter === 'all'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            الكل ({drafts.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeScopeFilter('factory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border ${
              scopeFilter === 'factory'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            المصنع ({drafts.filter((d) => (d.scope || 'factory') === 'factory').length})
          </button>
          <button
            type="button"
            onClick={() => onChangeScopeFilter('private')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border ${
              scopeFilter === 'private'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            خاص ({drafts.filter((d) => d.scope === 'private').length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => onAddDraft(scopeFilter === 'private' ? 'private' : 'factory')}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة مسودة</span>
        </button>
      </div>

      {/* Drafts Grid */}
      {filtered.length === 0 ? (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <FileEdit className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لا توجد مسودات في هذا التصنيف حالياً
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((d) => (
            <div
              key={d.id}
              onClick={() => onInspect({ kind: 'draft', id: d.id })}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors cursor-pointer flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={`px-2 py-0.5 rounded font-bold border ${
                      d.scope === 'private'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                    }`}
                  >
                    {d.scope === 'private' ? 'خاص' : 'المصنع'}
                  </span>
                  <span className="text-slate-400">{formatDateAr(d.updatedAt)}</span>
                </div>
                <h3 className="font-display text-sm font-extrabold text-slate-950 dark:text-white">
                  {d.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-3">
                  {d.content}
                </p>
              </div>

              <div
                className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                <PrintAsMenu
                  compact
                  onPrintPaperOrPdf={() =>
                    onPrintMemo({
                      headerMode: 'draft',
                      title: d.title,
                      content: d.content,
                      domain: 'company',
                      updatedAt: d.updatedAt,
                    })
                  }
                  onPreviewPrint={() =>
                    onPrintMemo(
                      {
                        headerMode: 'draft',
                        title: d.title,
                        content: d.content,
                        domain: 'company',
                        updatedAt: d.updatedAt,
                      },
                      { previewOnly: true }
                    )
                  }
                  onExportPdf={() =>
                    downloadMemoPdf({
                      headerMode: 'draft',
                      title: d.title,
                      content: d.content,
                      domain: 'company',
                      updatedAt: d.updatedAt,
                    })
                  }
                  onExportWord={async () => {
                    const blob = await generateWordDocxBlob({
                      headerMode: 'draft',
                      title: d.title,
                      subTitle: 'إدارة البيئة — مسودة عمل',
                      updatedAt: d.updatedAt,
                      bodyText: d.content,
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${d.title.slice(0, 40)}.docx`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                />
                <ConfirmDeleteInline compact onConfirm={() => onDeleteDraft(d.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
