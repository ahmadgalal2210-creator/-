import { useState } from 'react';
import { Building2, Plus, Reply, Send } from 'lucide-react';
import { generateWordDocxBlob } from '../../lib/fileParser';
import { downloadMemoPdf } from '../../lib/pdfExporter';
import type {
  CorrespondenceEntity,
  ExternalCorrespondence,
  InspectedItem,
  MemoDirection,
} from '../../types';
import { ConfirmDeleteInline } from '../ConfirmDeleteInline';
import type { PrintableMemoData } from '../MemoA4PrintSheet';
import { PrintAsMenu } from '../PrintAsMenu';

interface ExternalCorrespondenceViewProps {
  entities: CorrespondenceEntity[];
  correspondences: ExternalCorrespondence[];
  filterDirection: 'all' | MemoDirection;
  onChangeDirection: (dir: 'all' | MemoDirection) => void;
  onAddEntity: () => void;
  onAddCorrespondence: (entityId?: string) => void;
  onReplyCorrespondence: (corr: ExternalCorrespondence) => void;
  onDeleteEntity: (id: string) => Promise<void>;
  onDeleteCorrespondence: (id: string) => Promise<void>;
  onInspect: (item: InspectedItem) => void;
  onPrintMemo: (data: PrintableMemoData, options?: { previewOnly?: boolean }) => void;
}

export function ExternalCorrespondenceView({
  entities,
  correspondences,
  filterDirection,
  onChangeDirection,
  onAddEntity,
  onAddCorrespondence,
  onReplyCorrespondence,
  onDeleteEntity,
  onDeleteCorrespondence,
  onInspect,
  onPrintMemo,
}: ExternalCorrespondenceViewProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');

  const filtered = correspondences.filter((c) => {
    if (filterDirection !== 'all' && c.direction !== filterDirection) return false;
    if (selectedEntityId !== 'all' && c.entityId !== selectedEntityId) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'incoming', 'outgoing'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => onChangeDirection(dir)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                filterDirection === dir
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {dir === 'all' ? 'الكل' : dir === 'incoming' ? 'الوارد' : 'الصادر'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddEntity}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50"
          >
            <Building2 className="w-3.5 h-3.5 text-blue-700" />
            <span>+ إضافة جهة مراسلة</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onAddCorrespondence(selectedEntityId !== 'all' ? selectedEntityId : undefined)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مراسلة خارجية</span>
          </button>
        </div>
      </div>

      {/* Entities Filter Strip */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedEntityId('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
            selectedEntityId === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          كل الجهات ({entities.length})
        </button>
        {entities.map((ent) => (
          <div
            key={ent.id}
            className={`inline-flex items-center gap-1 pl-1.5 pr-3 py-1 rounded-lg border text-xs font-semibold ${
              selectedEntityId === ent.id
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <button
              type="button"
              onClick={() => setSelectedEntityId(ent.id)}
              className="hover:underline"
            >
              {ent.name}
            </button>
            <ConfirmDeleteInline
              compact
              label="حذف الجهة"
              onConfirm={() => onDeleteEntity(ent.id)}
            />
          </div>
        ))}
      </div>

      {/* Correspondences List */}
      {filtered.length === 0 ? (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Send className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لا توجد مراسلات خارجية في هذا التصنيف حالياً
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const threadPeersCount = correspondences.filter(
              (other) =>
                other.id !== c.id &&
                (other.threadId === (c.threadId || c.id) ||
                  other.replyToId === c.id ||
                  other.id === c.replyToId)
            ).length;

            return (
              <div
                key={c.id}
                onClick={() => onInspect({ kind: 'correspondence', id: c.id })}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors cursor-pointer space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded font-bold border ${
                          c.direction === 'incoming'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {c.direction === 'incoming' ? 'وارد' : 'صادر'}
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {c.entityName}
                      </span>
                      {c.refNumber && (
                        <span className="font-mono text-slate-500">#{c.refNumber}</span>
                      )}
                      <span className="text-slate-400">{c.date}</span>
                      {threadPeersCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold">
                          متسلسل ({threadPeersCount + 1})
                        </span>
                      )}
                    </div>

                    <h3 className="font-display text-sm font-extrabold text-slate-950 dark:text-white">
                      {c.subject}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 whitespace-pre-wrap">
                      {c.body}
                    </p>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onReplyCorrespondence(c)}
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
                          title: c.subject,
                          content: c.body,
                          domain: 'company',
                          direction: c.direction,
                          departmentName: c.entityName,
                          refNumber: c.refNumber,
                          updatedAt: c.date,
                        })
                      }
                      onPreviewPrint={() =>
                        onPrintMemo(
                          {
                            headerMode: 'memo',
                            title: c.subject,
                            content: c.body,
                            domain: 'company',
                            direction: c.direction,
                            departmentName: c.entityName,
                            refNumber: c.refNumber,
                            updatedAt: c.date,
                          },
                          { previewOnly: true }
                        )
                      }
                      onExportPdf={() =>
                        downloadMemoPdf({
                          headerMode: 'memo',
                          title: c.subject,
                          content: c.body,
                          domain: 'company',
                          direction: c.direction,
                          departmentName: c.entityName,
                          refNumber: c.refNumber,
                          updatedAt: c.date,
                        })
                      }
                      onExportWord={async () => {
                        const blob = await generateWordDocxBlob({
                          headerMode: 'memo',
                          title: c.subject,
                          departmentName: c.entityName,
                          refNumber: c.refNumber,
                          direction: c.direction,
                          updatedAt: c.date,
                          bodyText: c.body,
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${c.subject.slice(0, 40)}.docx`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    />

                    <ConfirmDeleteInline
                      compact
                      onConfirm={() => onDeleteCorrespondence(c.id)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
