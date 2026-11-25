import { useState } from 'react';
import { Download, FileText, Plus, Upload } from 'lucide-react';
import { getLocalBlob, saveLocalBlob } from '../../lib/blobStore';
import {
  cleanFileTitle,
  formatBytes,
  formatDateAr,
  generateWordDocxBlob,
  makeSafeId,
  parseDocumentFile,
} from '../../lib/fileParser';
import type {
  FileCategory,
  IndexedFile,
  InspectedItem,
  ProjectFolder,
} from '../../types';
import { ConfirmDeleteInline } from '../ConfirmDeleteInline';
import { CategoryIcon } from '../DomainLabels';

interface FilesViewProps {
  files: IndexedFile[];
  projects: ProjectFolder[];
  defaultProjectId?: string;
  onAddFileModal: () => void;
  onCreateFile: (f: Omit<IndexedFile, 'updatedAt'>) => Promise<void>;
  onUpdateFile: (id: string, updates: Partial<IndexedFile>) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
  onInspect: (item: InspectedItem) => void;
  onToast: (msg: string) => void;
}

export function FilesView({
  files,
  projects,
  defaultProjectId = '',
  onAddFileModal,
  onCreateFile,
  onUpdateFile,
  onDeleteFile,
  onInspect,
  onToast,
}: FilesViewProps) {
  const [catFilter, setCatFilter] = useState<'all' | FileCategory>('all');
  const [dragActive, setDragActive] = useState(false);

  const filtered = files.filter((f) =>
    catFilter === 'all' ? true : f.category === catFilter
  );

  const handleUploadFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    for (const file of Array.from(list)) {
      const parsed = await parseDocumentFile(file);
      const fid = makeSafeId('file');
      await saveLocalBlob(fid, file);
      await onCreateFile({
        id: fid,
        title: parsed.suggestedTitle || cleanFileTitle(file.name),
        fileName: file.name,
        category: parsed.category,
        domain: 'company',
        projectId: defaultProjectId,
        sizeBytes: file.size,
        notes: parsed.summaryText,
        hasBlob: true,
        mimeType: file.type || 'application/octet-stream',
        extractedText: parsed.extractedText,
        sheetPreview: parsed.sheetPreview,
        researchKind: 'none',
        headings: parsed.headings,
      });
      onToast(`تم رفع وفهرسة «${file.name}»`);
    }
  };

  const handleDownload = async (f: IndexedFile) => {
    const blob = await getLocalBlob(f.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.fileName;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const wordBlob = await generateWordDocxBlob({
      title: f.title,
      bodyText: f.extractedText || f.notes || f.title,
    });
    const url = URL.createObjectURL(wordBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${f.title.slice(0, 40)}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'الكل'],
              ['word', 'Word'],
              ['excel', 'Excel'],
              ['pdf', 'PDF'],
              ['other', 'أخرى'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setCatFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                catFilter === val
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              void handleUploadFiles(e.dataTransfer.files);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border-2 border-dashed text-xs font-bold cursor-pointer ${
              dragActive
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-blue-700" />
            <span>رفع سريع / سحب ملف</span>
            <input
              type="file"
              multiple
              accept=".doc,.docx,.xls,.xlsx,.csv,.pdf,.txt,.md"
              className="hidden"
              onChange={(e) => {
                void handleUploadFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={onAddFileModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة ملف</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لا توجد ملفات في هذا التصنيف حالياً
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((f) => (
            <div
              key={f.id}
              onClick={() => onInspect({ kind: 'file', id: f.id })}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors cursor-pointer space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <CategoryIcon category={f.category} className="w-5 h-5 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-display text-sm font-extrabold text-slate-950 dark:text-white truncate">
                      {f.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      {f.fileName} · {formatBytes(f.sizeBytes)} · {formatDateAr(f.updatedAt)}
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => void handleDownload(f)}
                    title="تحميل"
                    className="p-1.5 rounded-md text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <ConfirmDeleteInline compact onConfirm={() => onDeleteFile(f.id)} />
                </div>
              </div>

              {f.notes && (
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {f.notes}
                </p>
              )}

              <div
                className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] text-slate-500">المجلد:</span>
                <select
                  value={f.projectId}
                  onChange={(e) =>
                    void onUpdateFile(f.id, { projectId: e.target.value })
                  }
                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-[11px]"
                >
                  <option value="">بدون مجلد</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
