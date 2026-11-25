import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FolderKanban,
  Loader2,
  Mic,
  Pin,
  Reply,
  Save,
  Square,
  Star,
  X,
} from 'lucide-react';
import {
  formatVoiceSeconds,
  useVoiceDictation,
} from '../hooks/useVoiceDictation';
import { getLocalBlob } from '../lib/blobStore';
import {
  formatBytes,
  formatDateAr,
  generateWordDocxBlob,
} from '../lib/fileParser';
import { downloadMemoPdf } from '../lib/pdfExporter';
import { findTextMatches } from '../lib/searchEngine';
import type {
  ExternalCorrespondence,
  IncomingMessage,
  IndexedFile,
  IndexedImage,
  InspectedItem,
  ProjectFolder,
  WorkDraft,
  WorkMemo,
  WorkOrder,
  WorkOrderStatus,
  WorkspaceState,
} from '../types';
import { ConfirmDeleteInline } from './ConfirmDeleteInline';
import { CategoryIcon, researchKindLabel, statusLabel } from './DomainLabels';
import type { PrintableMemoData } from './MemoA4PrintSheet';
import { PrintAsMenu } from './PrintAsMenu';

interface InspectorDrawerProps {
  inspected: InspectedItem | null;
  workspace: WorkspaceState;
  onClose: () => void;
  onInspect: (item: InspectedItem) => void;
  onUpdateFile: (id: string, updates: Partial<IndexedFile>) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
  onUpdateImage: (id: string, updates: Partial<IndexedImage>) => Promise<void>;
  onDeleteImage: (id: string) => Promise<void>;
  onUpdateMemo: (id: string, updates: Partial<WorkMemo>) => Promise<void>;
  onDeleteMemo: (id: string) => Promise<void>;
  onReplyMemo: (memo: WorkMemo) => void;
  onUpdateDraft: (id: string, updates: Partial<WorkDraft>) => Promise<void>;
  onDeleteDraft: (id: string) => Promise<void>;
  onUpdateOrder: (id: string, updates: Partial<WorkOrder>) => Promise<void>;
  onDeleteOrder: (id: string) => Promise<void>;
  onFollowUpOrder: (order: WorkOrder) => Promise<void>;
  onUpdateCorrespondence: (
    id: string,
    updates: Partial<ExternalCorrespondence>
  ) => Promise<void>;
  onDeleteCorrespondence: (id: string) => Promise<void>;
  onReplyCorrespondence: (corr: ExternalCorrespondence) => void;
  onDeleteMessage: (id: string) => Promise<void>;
  onPrintMemo: (data: PrintableMemoData, options?: { previewOnly?: boolean }) => void;
  onToast: (msg: string) => void;
}

function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
  const matches = findTextMatches(text, query);
  if (matches.length === 0) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, idx) => {
    if (m.start > cursor) {
      nodes.push(text.slice(cursor, m.start));
    }
    nodes.push(
      <mark
        key={idx}
        className="bg-amber-200 dark:bg-amber-700/70 text-slate-950 dark:text-white px-0.5 rounded"
      >
        {text.slice(m.start, m.end)}
      </mark>
    );
    cursor = m.end;
  });
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return <span className="whitespace-pre-wrap">{nodes}</span>;
}

export function InspectorDrawer({
  inspected,
  workspace,
  onClose,
  onInspect,
  onUpdateFile,
  onDeleteFile,
  onUpdateImage,
  onDeleteImage,
  onUpdateMemo,
  onDeleteMemo,
  onReplyMemo,
  onUpdateDraft,
  onDeleteDraft,
  onUpdateOrder,
  onDeleteOrder,
  onFollowUpOrder,
  onUpdateCorrespondence,
  onDeleteCorrespondence,
  onReplyCorrespondence,
  onDeleteMessage,
  onPrintMemo,
  onToast,
}: InspectorDrawerProps) {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [imageFullUrl, setImageFullUrl] = useState<string | null>(null);

  // Local editable drafts for active inspected item
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editTechs, setEditTechs] = useState('');
  const [saving, setSaving] = useState(false);

  const bodyVoice = useVoiceDictation({
    onTranscript: (text) => {
      setEditBody((prev) => (prev ? `${prev}\n${text}` : text));
    },
    onStatus: onToast,
  });

  const titleVoice = useVoiceDictation({
    onTranscript: (text) => {
      setEditTitle((prev) => (prev ? `${prev} ${text}` : text));
    },
    onStatus: onToast,
  });

  const techsVoice = useVoiceDictation({
    onTranscript: (text) => {
      setEditTechs((prev) => (prev ? `${prev}، ${text}` : text));
    },
    onStatus: onToast,
  });

  const fileItem =
    inspected?.kind === 'file'
      ? workspace.files.find((f) => f.id === inspected.id) || null
      : null;
  const imageItem =
    inspected?.kind === 'image'
      ? workspace.images.find((i) => i.id === inspected.id) || null
      : null;
  const memoItem =
    inspected?.kind === 'memo'
      ? workspace.memos.find((m) => m.id === inspected.id) || null
      : null;
  const draftItem =
    inspected?.kind === 'draft'
      ? workspace.drafts.find((d) => d.id === inspected.id) || null
      : null;
  const orderItem =
    inspected?.kind === 'order'
      ? workspace.orders.find((o) => o.id === inspected.id) || null
      : null;
  const corrItem =
    inspected?.kind === 'correspondence'
      ? workspace.correspondences.find((c) => c.id === inspected.id) || null
      : null;
  const msgItem =
    inspected?.kind === 'message'
      ? workspace.messages.find((m) => m.id === inspected.id) || null
      : null;
  const projItem =
    inspected?.kind === 'project'
      ? workspace.projects.find((p) => p.id === inspected.id) || null
      : null;

  useEffect(() => {
    bodyVoice.cancel();
    titleVoice.cancel();
    techsVoice.cancel();
    setActiveSheetIdx(inspected?.focusSearch?.sheetIndex ?? 0);
    setImageFullUrl(null);
    if (fileItem) {
      setEditTitle(fileItem.title);
      setEditBody(fileItem.notes);
    } else if (imageItem) {
      setEditTitle(imageItem.title);
      setEditBody(imageItem.caption);
      void getLocalBlob(imageItem.id).then((blob) => {
        if (blob) {
          setImageFullUrl(URL.createObjectURL(blob));
        }
      });
    } else if (memoItem) {
      setEditTitle(memoItem.title);
      setEditBody(memoItem.content);
      setEditDept(memoItem.departmentName || '');
    } else if (draftItem) {
      setEditTitle(draftItem.title);
      setEditBody(draftItem.content);
    } else if (orderItem) {
      setEditTitle(orderItem.title);
      setEditBody(orderItem.details);
      setEditTechs((orderItem.technicians || []).join('، '));
    } else if (corrItem) {
      setEditTitle(corrItem.subject);
      setEditBody(corrItem.body);
      setEditRef(corrItem.refNumber);
    }
    return () => {
      if (imageFullUrl) URL.revokeObjectURL(imageFullUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspected?.kind, inspected?.id]);

  if (!inspected) return null;

  const projectName = (pid?: string) =>
    workspace.projects.find((p) => p.id === pid)?.name || 'غير مصنف';

  const handleDownloadBlob = async (id: string, fallbackName: string, fallbackText = '') => {
    const blob = await getLocalBlob(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fallbackName;
      a.click();
      URL.revokeObjectURL(url);
      onToast(`تم تحميل الملف: ${fallbackName}`);
      return;
    }
    if (fallbackText) {
      const wordBlob = await generateWordDocxBlob({
        title: fallbackName,
        bodyText: fallbackText,
      });
      const url = URL.createObjectURL(wordBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fallbackName.replace(/\.[^.]+$/, '')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      onToast('تم تصدير المحتوى النصي كملف Word (.docx)');
      return;
    }
    onToast('الملف الأصلي محفوظ على الجهاز الذي تم رفعه منه فقط');
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100';

  const renderVoiceMicButton = (
    voice: ReturnType<typeof useVoiceDictation> = bodyVoice,
    disabled = false,
    idleLabel = 'إضافة / تعديل صوتي'
  ) => (
    <button
      type="button"
      disabled={disabled || voice.state === 'transcribing'}
      onClick={() => void voice.toggle()}
      title="اضغط للتسجيل الصوتي وكتابة النص تلقائياً"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-60 ${
        voice.state === 'recording'
          ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
          : voice.state === 'transcribing'
            ? 'bg-amber-600 text-white cursor-wait'
            : 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
      }`}
    >
      {voice.state === 'recording' ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          <Square className="w-3 h-3 fill-current" />
          <span>إيقاف ({formatVoiceSeconds(voice.seconds)})</span>
        </>
      ) : voice.state === 'transcribing' ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>جاري التفريغ لنص...</span>
        </>
      ) : (
        <>
          <Mic className="w-3 h-3" />
          <span>{idleLabel}</span>
        </>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end no-print">
      <div
        className="fixed inset-0 bg-slate-950/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 w-full max-w-2xl h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
              معاينة وتحرير العنصر
            </p>
            <h3 className="font-display text-sm font-extrabold text-slate-950 dark:text-white truncate">
              {fileItem?.title ||
                imageItem?.title ||
                memoItem?.title ||
                draftItem?.title ||
                orderItem?.title ||
                corrItem?.subject ||
                msgItem?.subject ||
                projItem?.name ||
                'تفاصيل'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المعاينة"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* FILE INSPECTOR */}
          {fileItem && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <CategoryIcon category={fileItem.category} className="w-5 h-5" />
                  <div className="text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">{fileItem.fileName}</p>
                    <p className="text-[11px] text-slate-500">
                      {formatBytes(fileItem.sizeBytes)} · {formatDateAr(fileItem.updatedAt)} ·{' '}
                      {researchKindLabel(fileItem.researchKind)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateFile(fileItem.id, { starred: !fileItem.starred })
                    }
                    className={`p-1.5 rounded-lg border ${
                      fileItem.starred
                        ? 'border-amber-300 bg-amber-50 text-amber-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-400'
                    }`}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleDownloadBlob(
                        fileItem.id,
                        fileItem.fileName,
                        fileItem.extractedText || fileItem.notes
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تحميل
                  </button>
                  <ConfirmDeleteInline
                    onConfirm={async () => {
                      await onDeleteFile(fileItem.id);
                      onClose();
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">العنوان</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">المجلد</label>
                  <select
                    value={fileItem.projectId}
                    onChange={(e) =>
                      void onUpdateFile(fileItem.id, { projectId: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">بدون مجلد</option>
                    {workspace.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold">الملخص والملاحظات</label>
                  {renderVoiceMicButton()}
                </div>
                <textarea
                  rows={4}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await onUpdateFile(fileItem.id, {
                        title: editTitle.trim() || fileItem.title,
                        notes: editBody.trim(),
                      });
                      onToast('تم حفظ تعديلات الملف');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold"
                >
                  <Save className="w-3.5 h-3.5" />
                  حفظ التعديلات
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const blob = await generateWordDocxBlob({
                      title: editTitle || fileItem.title,
                      bodyText: fileItem.extractedText || editBody,
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${(editTitle || fileItem.title).slice(0, 40)}.docx`;
                    a.click();
                    URL.revokeObjectURL(url);
                    onToast('تم تصدير المستند بصيغة Word (.docx)');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-bold"
                >
                  <FileText className="w-3.5 h-3.5" />
                  تحويل لملف Word (.docx)
                </button>
              </div>

              {fileItem.headings && fileItem.headings.length > 0 && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    التسلسل السريع / الفهرس ({fileItem.headings.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {fileItem.headings.map((h, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {fileItem.sheetPreview && fileItem.sheetPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {fileItem.sheetPreview.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveSheetIdx(idx)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                          activeSheetIdx === idx
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {s.sheetName}
                      </button>
                    ))}
                  </div>
                  {fileItem.sheetPreview[activeSheetIdx] && (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-72">
                      <table className="w-full text-right text-[11px]">
                        <thead className="bg-slate-100 dark:bg-slate-800">
                          <tr>
                            {fileItem.sheetPreview[activeSheetIdx].headers.map((h, i) => (
                              <th key={i} className="px-2.5 py-1.5 font-bold whitespace-nowrap">
                                <HighlightedText text={h || '—'} query={inspected.focusSearch?.query} />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {fileItem.sheetPreview[activeSheetIdx].rows.map((r, rIdx) => (
                            <tr
                              key={rIdx}
                              className="border-t border-slate-100 dark:border-slate-800"
                            >
                              {r.map((cell, cIdx) => (
                                <td key={cIdx} className="px-2.5 py-1.5 whitespace-nowrap">
                                  <HighlightedText text={cell} query={inspected.focusSearch?.query} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {fileItem.extractedText && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs leading-relaxed max-h-80 overflow-y-auto">
                  <HighlightedText
                    text={fileItem.extractedText}
                    query={inspected.focusSearch?.query}
                  />
                </div>
              )}
            </div>
          )}

          {/* IMAGE INSPECTOR */}
          {imageItem && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center max-h-96">
                {imageFullUrl || imageItem.thumbnailDataUrl ? (
                  <img
                    src={imageFullUrl || imageItem.thumbnailDataUrl}
                    alt={imageItem.title}
                    className="max-h-96 object-contain"
                  />
                ) : (
                  <p className="p-8 text-xs text-slate-500">لا توجد معاينة محفوظة لهذه الصورة</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">العنوان</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">المجلد</label>
                  <select
                    value={imageItem.projectId}
                    onChange={(e) =>
                      void onUpdateImage(imageItem.id, { projectId: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">بدون مجلد</option>
                    {workspace.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold">التعليق / الملخص</label>
                  {renderVoiceMicButton()}
                </div>
                <textarea
                  rows={3}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await onUpdateImage(imageItem.id, {
                        title: editTitle.trim() || imageItem.title,
                        caption: editBody.trim(),
                      });
                      onToast('تم حفظ بيانات الصورة');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleDownloadBlob(imageItem.id, imageItem.fileName, editBody)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تحميل
                  </button>
                </div>
                <ConfirmDeleteInline
                  onConfirm={async () => {
                    await onDeleteImage(imageItem.id);
                    onClose();
                  }}
                />
              </div>
            </div>
          )}

          {/* MEMO INSPECTOR (EDITABLE + REPLY THREAD + PRINT AS) */}
          {memoItem && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold">
                    {memoItem.direction === 'incoming' ? 'وارد المصنع' : 'صادر المصنع'}
                  </span>
                  <span className="text-slate-500">{formatDateAr(memoItem.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onReplyMemo(memoItem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    رد عليه (إلى {memoItem.direction === 'incoming' ? 'الصادر' : 'الوارد'})
                  </button>
                  <PrintAsMenu
                    compact
                    onPrintPaperOrPdf={() =>
                      onPrintMemo({
                        headerMode: 'memo',
                        title: editTitle || memoItem.title,
                        content: editBody || memoItem.content,
                        domain: memoItem.domain,
                        direction: memoItem.direction,
                        departmentName: editDept || memoItem.departmentName,
                        projectName: projectName(memoItem.projectId),
                        updatedAt: memoItem.updatedAt,
                      })
                    }
                    onPreviewPrint={() =>
                      onPrintMemo(
                        {
                          headerMode: 'memo',
                          title: editTitle || memoItem.title,
                          content: editBody || memoItem.content,
                          domain: memoItem.domain,
                          direction: memoItem.direction,
                          departmentName: editDept || memoItem.departmentName,
                          projectName: projectName(memoItem.projectId),
                          updatedAt: memoItem.updatedAt,
                        },
                        { previewOnly: true }
                      )
                    }
                    onExportPdf={() =>
                      downloadMemoPdf({
                        headerMode: 'memo',
                        title: editTitle || memoItem.title,
                        content: editBody || memoItem.content,
                        domain: memoItem.domain,
                        direction: memoItem.direction,
                        departmentName: editDept || memoItem.departmentName,
                        projectName: projectName(memoItem.projectId),
                        updatedAt: memoItem.updatedAt,
                      })
                    }
                    onExportWord={async () => {
                      const blob = await generateWordDocxBlob({
                        headerMode: 'memo',
                        title: editTitle || memoItem.title,
                        departmentName: editDept || memoItem.departmentName,
                        direction: memoItem.direction,
                        projectName: projectName(memoItem.projectId),
                        updatedAt: memoItem.updatedAt,
                        bodyText: editBody || memoItem.content,
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${(editTitle || memoItem.title).slice(0, 40)}.docx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  />
                  <ConfirmDeleteInline
                    onConfirm={async () => {
                      await onDeleteMemo(memoItem.id);
                      onClose();
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">عنوان المذكرة</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">الإدارة / الجهة</label>
                  <input
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold">المحتوى / الملخص</label>
                  {renderVoiceMicButton()}
                </div>
                <textarea
                  rows={8}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateMemo(memoItem.id, {
                      title: editTitle.trim() || memoItem.title,
                      content: editBody,
                      departmentName: editDept.trim(),
                    });
                    onToast('تم حفظ تعديلات المذكرة');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold"
                >
                  <Save className="w-3.5 h-3.5" />
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void onUpdateMemo(memoItem.id, { pinned: !memoItem.pinned })
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  <Pin className="w-3.5 h-3.5" />
                  {memoItem.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
                </button>
              </div>

              {/* Thread Links */}
              {(() => {
                const tid = memoItem.threadId || memoItem.id;
                const peers = workspace.memos.filter(
                  (m) => m.id !== memoItem.id && (m.threadId === tid || m.replyToId === memoItem.id || m.id === memoItem.replyToId)
                );
                if (peers.length === 0) return null;
                return (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-bold">سلسلة المذكرات والردود المرتبطة ({peers.length})</p>
                    <div className="space-y-1.5">
                      {peers.map((peer) => (
                        <button
                          key={peer.id}
                          type="button"
                          onClick={() => onInspect({ kind: 'memo', id: peer.id })}
                          className="w-full text-right p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-xs flex items-center justify-between"
                        >
                          <span className="font-semibold truncate">{peer.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 shrink-0">
                            {peer.direction === 'incoming' ? 'وارد' : 'صادر'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* DRAFT INSPECTOR */}
          {draftItem && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                  مسودة ({draftItem.scope === 'private' ? 'خاص' : 'المصنع'})
                </span>
                <div className="flex items-center gap-2">
                  <PrintAsMenu
                    compact
                    onPrintPaperOrPdf={() =>
                      onPrintMemo({
                        headerMode: 'draft',
                        title: editTitle || draftItem.title,
                        content: editBody || draftItem.content,
                        domain: 'company',
                        projectName: projectName(draftItem.projectId),
                        updatedAt: draftItem.updatedAt,
                      })
                    }
                    onPreviewPrint={() =>
                      onPrintMemo(
                        {
                          headerMode: 'draft',
                          title: editTitle || draftItem.title,
                          content: editBody || draftItem.content,
                          domain: 'company',
                          projectName: projectName(draftItem.projectId),
                          updatedAt: draftItem.updatedAt,
                        },
                        { previewOnly: true }
                      )
                    }
                    onExportPdf={() =>
                      downloadMemoPdf({
                        headerMode: 'draft',
                        title: editTitle || draftItem.title,
                        content: editBody || draftItem.content,
                        domain: 'company',
                        projectName: projectName(draftItem.projectId),
                        updatedAt: draftItem.updatedAt,
                      })
                    }
                    onExportWord={async () => {
                      const blob = await generateWordDocxBlob({
                        headerMode: 'draft',
                        title: editTitle || draftItem.title,
                        subTitle: 'إدارة البيئة — مسودة عمل',
                        projectName: projectName(draftItem.projectId),
                        updatedAt: draftItem.updatedAt,
                        bodyText: editBody || draftItem.content,
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${(editTitle || draftItem.title).slice(0, 40)}.docx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  />
                  <ConfirmDeleteInline
                    onConfirm={async () => {
                      await onDeleteDraft(draftItem.id);
                      onClose();
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold">عنوان المسودة</label>
                  {renderVoiceMicButton(titleVoice, false, 'إدخال صوتي')}
                </div>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold">النص</label>
                  {renderVoiceMicButton()}
                </div>
                <textarea
                  rows={10}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  await onUpdateDraft(draftItem.id, {
                    title: editTitle.trim() || draftItem.title,
                    content: editBody,
                  });
                  onToast('تم حفظ المسودة');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold"
              >
                <Save className="w-3.5 h-3.5" />
                حفظ المسودة
              </button>
            </div>
          )}

          {/* WORK ORDER INSPECTOR */}
          {orderItem && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800">
                    {orderItem.refCode}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded border ${
                      statusLabel(orderItem.status).classes
                    }`}
                  >
                    {statusLabel(orderItem.status).text}
                  </span>
                </div>
                <ConfirmDeleteInline
                  onConfirm={async () => {
                    await onDeleteOrder(orderItem.id);
                    onClose();
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold">عنوان العمل</label>
                  {renderVoiceMicButton(
                    titleVoice,
                    orderItem.status === 'done',
                    'إدخال صوتي'
                  )}
                </div>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={orderItem.status === 'done'}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">تحديث الحالة</label>
                  <select
                    value={orderItem.status}
                    disabled={orderItem.status === 'done'}
                    onChange={(e) =>
                      void onUpdateOrder(orderItem.id, {
                        status: e.target.value as WorkOrderStatus,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="new">جديد</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="review">بانتظار المراجعة</option>
                    <option value="done">مكتمل</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-bold">الفنيون المكلفون</label>
                    {renderVoiceMicButton(
                      techsVoice,
                      orderItem.status === 'done',
                      'إدخال صوتي'
                    )}
                  </div>
                  <input
                    value={editTechs}
                    disabled={orderItem.status === 'done'}
                    onChange={(e) => setEditTechs(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold">تفاصيل التنفيذ</label>
                  {renderVoiceMicButton(bodyVoice, orderItem.status === 'done')}
                </div>
                <textarea
                  rows={5}
                  value={editBody}
                  disabled={orderItem.status === 'done'}
                  onChange={(e) => setEditBody(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {orderItem.status !== 'done' ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onUpdateOrder(orderItem.id, {
                          title: editTitle.trim() || orderItem.title,
                          details: editBody,
                          technicians: editTechs
                            .split(/[,،\n]+/)
                            .map((t) => t.trim())
                            .filter(Boolean),
                        });
                        onToast('تم تحديث مذكرة الأعمال');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold"
                    >
                      <Save className="w-3.5 h-3.5" />
                      حفظ التعديلات
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateOrder(orderItem.id, { isAssigned: !orderItem.isAssigned })
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold ${
                        orderItem.isAssigned
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {orderItem.isAssigned ? 'تم التكليف ✓' : 'تأكيد التكليف'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onFollowUpOrder(orderItem)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    متابعة (نسخ لمذكرة أعمال جديدة)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* EXTERNAL CORRESPONDENCE INSPECTOR */}
          {corrItem && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-slate-900 dark:text-white">
                    {corrItem.entityName} ·{' '}
                    <span className="text-blue-700 dark:text-blue-400">
                      {corrItem.direction === 'incoming' ? 'وارد' : 'صادر'}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    التاريخ: {corrItem.date} · مرجع: {corrItem.refNumber || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onReplyCorrespondence(corrItem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    رد عليه
                  </button>
                  <PrintAsMenu
                    compact
                    onPrintPaperOrPdf={() =>
                      onPrintMemo({
                        headerMode: 'memo',
                        title: editTitle || corrItem.subject,
                        content: editBody || corrItem.body,
                        domain: 'company',
                        direction: corrItem.direction,
                        departmentName: corrItem.entityName,
                        refNumber: editRef || corrItem.refNumber,
                        updatedAt: corrItem.date,
                      })
                    }
                    onPreviewPrint={() =>
                      onPrintMemo(
                        {
                          headerMode: 'memo',
                          title: editTitle || corrItem.subject,
                          content: editBody || corrItem.body,
                          domain: 'company',
                          direction: corrItem.direction,
                          departmentName: corrItem.entityName,
                          refNumber: editRef || corrItem.refNumber,
                          updatedAt: corrItem.date,
                        },
                        { previewOnly: true }
                      )
                    }
                    onExportPdf={() =>
                      downloadMemoPdf({
                        headerMode: 'memo',
                        title: editTitle || corrItem.subject,
                        content: editBody || corrItem.body,
                        domain: 'company',
                        direction: corrItem.direction,
                        departmentName: corrItem.entityName,
                        refNumber: editRef || corrItem.refNumber,
                        updatedAt: corrItem.date,
                      })
                    }
                    onExportWord={async () => {
                      const blob = await generateWordDocxBlob({
                        headerMode: 'memo',
                        title: editTitle || corrItem.subject,
                        departmentName: corrItem.entityName,
                        refNumber: editRef || corrItem.refNumber,
                        direction: corrItem.direction,
                        updatedAt: corrItem.date,
                        bodyText: editBody || corrItem.body,
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${(editTitle || corrItem.subject).slice(0, 40)}.docx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  />
                  <ConfirmDeleteInline
                    onConfirm={async () => {
                      await onDeleteCorrespondence(corrItem.id);
                      onClose();
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">الموضوع</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">رقم القيد</label>
                  <input
                    value={editRef}
                    onChange={(e) => setEditRef(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold">محتوى المراسلة</label>
                  {renderVoiceMicButton()}
                </div>
                <textarea
                  rows={8}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  await onUpdateCorrespondence(corrItem.id, {
                    subject: editTitle.trim() || corrItem.subject,
                    refNumber: editRef.trim(),
                    body: editBody,
                  });
                  onToast('تم حفظ تعديلات المراسلة');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold"
              >
                <Save className="w-3.5 h-3.5" />
                حفظ التعديلات
              </button>

              {(() => {
                const tid = corrItem.threadId || corrItem.id;
                const peers = workspace.correspondences.filter(
                  (c) =>
                    c.id !== corrItem.id &&
                    (c.threadId === tid || c.replyToId === corrItem.id || c.id === corrItem.replyToId)
                );
                if (peers.length === 0) return null;
                return (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-bold">سلسلة المراسلات المرتبطة ({peers.length})</p>
                    <div className="space-y-1.5">
                      {peers.map((peer) => (
                        <button
                          key={peer.id}
                          type="button"
                          onClick={() => onInspect({ kind: 'correspondence', id: peer.id })}
                          className="w-full text-right p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-xs flex items-center justify-between"
                        >
                          <span className="font-semibold truncate">{peer.subject}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                            {peer.direction === 'incoming' ? 'وارد' : 'صادر'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MESSAGE INSPECTOR */}
          {msgItem && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <p className="font-bold">{msgItem.senderName}</p>
                  <p className="text-slate-500">{msgItem.senderRole}</p>
                </div>
                <ConfirmDeleteInline
                  onConfirm={async () => {
                    await onDeleteMessage(msgItem.id);
                    onClose();
                  }}
                />
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs whitespace-pre-wrap leading-relaxed">
                {msgItem.body}
              </div>
            </div>
          )}

          {/* PROJECT INSPECTOR */}
          {projItem && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <FolderKanban className="w-4 h-4 text-blue-700" />
                  <span>{projItem.name}</span>
                </div>
                <p className="text-slate-500">{projItem.description || 'مجلد عمل منظم'}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
