import { FileText, Mail, Plus, Reply, Upload } from 'lucide-react';
import { formatDateAr, generateWordDocxBlob } from '../../lib/fileParser';
import { downloadMemoPdf } from '../../lib/pdfExporter';
import type {
  IndexedFile,
  InspectedItem,
  MemoDirection,
  WorkMemo,
} from '../../types';
import { ConfirmDeleteInline } from '../ConfirmDeleteInline';
import { CategoryIcon } from '../DomainLabels';
import type { PrintableMemoData } from '../MemoA4PrintSheet';
import { PrintAsMenu } from '../PrintAsMenu';

interface MemosViewProps {
  memos: WorkMemo[];
  files: IndexedFile[];
  direction: MemoDirection;
  onChangeDirection: (dir: MemoDirection) => void;
  onAddMemo: (dir: MemoDirection) => void;
  onReplyMemo: (memo: WorkMemo) => void;
  onDeleteMemo: (id: string) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
  onInspect: (item: InspectedItem) => void;
  onPrintMemo: (data: PrintableMemoData, options?: { previewOnly?: boolean }) => void;
}

export function MemosView({
  memos,
  files,
  direction,
  onChangeDirection,
  onAddMemo,
  onReplyMemo,
  onDeleteMemo,
  onDeleteFile,
  onInspect,
  onPrintMemo,
}: MemosViewProps) {
  const filteredMemos = memos.filter((m) => (m.direction || 'outgoing') === direction);

  const outgoingAttachedIds = new Set(
    memos
      .filter((m) => (m.direction || 'outgoing') === 'outgoing')
      .flatMap((m) => m.linkedFileIds || [])
  );
  const registeredOutgoingFiles = files.filter(
    (f) => outgoingAttachedIds.has(f.id) || f.domain === 'company'
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeDirection('incoming')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              direction === 'incoming'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            الوارد ({memos.filter((m) => m.direction === 'incoming').length})
          </button>
          <button
            type="button"
            onClick={() => onChangeDirection('outgoing')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              direction === 'outgoing'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            الصادر ({memos.filter((m) => (m.direction || 'outgoing') === 'outgoing').length})
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {direction === 'incoming' && (
            <button
              type="button"
              onClick={() => onAddMemo('incoming')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>رفع ملف للوارد + ملخص تلقائي</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onAddMemo(direction)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{direction === 'incoming' ? 'إضافة وارد جديد' : 'إضافة مذكرة صادرة'}</span>
          </button>
        </div>
      </div>

      {/* Memos List */}
      {filteredMemos.length === 0 ? (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Mail className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لا توجد مذكرات في قائمة {direction === 'incoming' ? 'الوارد' : 'الصادر'} حالياً
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMemos.map((m) => {
            const threadPeersCount = memos.filter(
              (other) =>
                other.id !== m.id &&
                (other.threadId === (m.threadId || m.id) ||
                  other.replyToId === m.id ||
                  other.id === m.replyToId)
            ).length;

            const attachedNames = (m.linkedFileIds || [])
              .map((fid) => files.find((f) => f.id === fid)?.fileName)
              .filter(Boolean) as string[];

            return (
              <div
                key={m.id}
                onClick={() => onInspect({ kind: 'memo', id: m.id })}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors cursor-pointer space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded font-bold border ${
                          m.direction === 'incoming'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200'
                        }`}
                      >
                        {m.direction === 'incoming' ? 'وارد' : 'صادر'}
                      </span>
                      {m.departmentName && (
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {m.departmentName}
                        </span>
                      )}
                      <span className="text-slate-400">{formatDateAr(m.updatedAt)}</span>
                      {threadPeersCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
                          مربوطة بسلسلة ردود ({threadPeersCount + 1})
                        </span>
                      )}
                    </div>

                    <h3 className="font-display text-sm font-extrabold text-slate-950 dark:text-white">
                      {m.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-3">
                      {m.content}
                    </p>

                    {attachedNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {attachedNames.map((n, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold"
                          >
                            <FileText className="w-3 h-3 text-blue-600" />
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onReplyMemo(m)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
                    >
                      <Reply className="w-3.5 h-3.5" />
                      <span>رد عليه</span>
                    </button>

                    <PrintAsMenu
                      compact
                      onPrintPaperOrPdf={() =>
                        onPrintMemo({
                          headerMode: 'memo',
                          title: m.title,
                          content: m.content,
                          domain: m.domain,
                          direction: m.direction,
                          departmentName: m.departmentName,
                          updatedAt: m.updatedAt,
                          linkedFileNames: attachedNames,
                        })
                      }
                      onPreviewPrint={() =>
                        onPrintMemo(
                          {
                            headerMode: 'memo',
                            title: m.title,
                            content: m.content,
                            domain: m.domain,
                            direction: m.direction,
                            departmentName: m.departmentName,
                            updatedAt: m.updatedAt,
                            linkedFileNames: attachedNames,
                          },
                          { previewOnly: true }
                        )
                      }
                      onExportPdf={() =>
                        downloadMemoPdf({
                          headerMode: 'memo',
                          title: m.title,
                          content: m.content,
                          domain: m.domain,
                          direction: m.direction,
                          departmentName: m.departmentName,
                          updatedAt: m.updatedAt,
                          linkedFileNames: attachedNames,
                        })
                      }
                      onExportWord={async () => {
                        const blob = await generateWordDocxBlob({
                          headerMode: 'memo',
                          title: m.title,
                          departmentName: m.departmentName,
                          direction: m.direction,
                          updatedAt: m.updatedAt,
                          linkedFileNames: attachedNames,
                          bodyText: m.content,
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${m.title.slice(0, 40)}.docx`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    />

                    <ConfirmDeleteInline compact onConfirm={() => onDeleteMemo(m.id)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Outgoing Files Register (Shown at the end of Outgoing view) */}
      {direction === 'outgoing' && registeredOutgoingFiles.length > 0 && (
        <section className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="font-display text-xs font-extrabold text-slate-900 dark:text-white">
            سجل الملفات والمستندات المرفقة / المسجلة بالصادر ({registeredOutgoingFiles.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {registeredOutgoingFiles.map((f) => (
              <div
                key={f.id}
                onClick={() => onInspect({ kind: 'file', id: f.id })}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 hover:border-blue-400 cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon category={f.category} className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {f.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{f.fileName}</p>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <ConfirmDeleteInline compact onConfirm={() => onDeleteFile(f.id)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
