import { useEffect, useState } from 'react';
import { BookOpen, ListTree, Plus, Upload, X } from 'lucide-react';
import { saveLocalBlob } from '../../lib/blobStore';
import {
  cleanFileTitle,
  formatBytes,
  formatDateAr,
  makeSafeId,
  parseDocumentFile,
} from '../../lib/fileParser';
import type {
  IndexedFile,
  InspectedItem,
  ResearchKind,
} from '../../types';
import { ConfirmDeleteInline } from '../ConfirmDeleteInline';
import { CategoryIcon, researchKindLabel } from '../DomainLabels';

interface ResearchViewProps {
  files: IndexedFile[];
  defaultProjectId?: string;
  onAddResearchModal: () => void;
  onCreateFile: (f: Omit<IndexedFile, 'updatedAt'>) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
  onInspect: (item: InspectedItem) => void;
  onToast: (msg: string) => void;
}

export function ResearchView({
  files,
  defaultProjectId = '',
  onAddResearchModal,
  onCreateFile,
  onDeleteFile,
  onInspect,
  onToast,
}: ResearchViewProps) {
  const [kindFilter, setKindFilter] = useState<'all' | Exclude<ResearchKind, 'none'>>('all');
  const [dragActive, setDragActive] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: IndexedFile;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const researchFiles = files.filter((f) => {
    const isRes = (f.researchKind && f.researchKind !== 'none') || f.domain === 'university';
    if (!isRes) return false;
    if (kindFilter !== 'all' && f.researchKind !== kindFilter) return false;
    return true;
  });

  const handleDropFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      const parsed = await parseDocumentFile(file);
      const fid = makeSafeId('res');
      await saveLocalBlob(fid, file);
      await onCreateFile({
        id: fid,
        title: parsed.suggestedTitle || cleanFileTitle(file.name),
        fileName: file.name,
        category: parsed.category,
        domain: 'university',
        projectId: defaultProjectId,
        sizeBytes: file.size,
        notes: parsed.summaryText,
        hasBlob: true,
        mimeType: file.type || 'application/octet-stream',
        extractedText: parsed.extractedText,
        sheetPreview: parsed.sheetPreview,
        researchKind: 'paper',
        headings: parsed.headings,
      });
      onToast(`تمت إضافة «${parsed.suggestedTitle}» وفهرسة التسلسل السريع تلقائياً`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Dr. Ayman Research Profile Card */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-extrabold text-slate-950 dark:text-white">
              د. أيمن عبد الحميد — الأبحاث والدراسات العلمية
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              دكتوراه في الكيمياء والسلامة المهنية · كليك شمال لفتح البحث — كليك يمين لفتح التسلسل السريع (الفصول / الأوراق)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddResearchModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة بحث / رسالة</span>
        </button>
      </div>

      {/* Filter & Dropzone */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'الكل'],
              ['phd', 'رسائل الدكتوراه'],
              ['masters', 'رسائل الماجستير'],
              ['paper', 'أوراق بحثية'],
              ['book', 'كتب ومراجع'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setKindFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                kindFilter === val
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            void handleDropFiles(e.dataTransfer.files);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed text-xs font-bold cursor-pointer transition-colors ${
            dragActive
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500'
          }`}
        >
          <Upload className="w-4 h-4 text-blue-700" />
          <span>اسحب الملف هنا أو اضغط للرفع التلقائي</span>
          <input
            type="file"
            multiple
            accept=".doc,.docx,.xls,.xlsx,.pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              void handleDropFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* Research List */}
      {researchFiles.length === 0 ? (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لا توجد أبحاث أو رسائل مضافة في هذا التصنيف حالياً
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {researchFiles.map((f) => {
            const outlineCount =
              (f.headings?.length || 0) + (f.sheetPreview?.length || 0);
            return (
              <div
                key={f.id}
                onClick={() => onInspect({ kind: 'file', id: f.id })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: Math.min(e.clientX, window.innerWidth - 280),
                    y: Math.min(e.clientY, window.innerHeight - 260),
                    file: f,
                  });
                }}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <CategoryIcon category={f.category} className="w-5 h-5 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 mb-1">
                        {researchKindLabel(f.researchKind)}
                      </span>
                      <h4 className="font-display text-sm font-extrabold text-slate-950 dark:text-white truncate">
                        {f.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        {f.fileName} · {formatBytes(f.sizeBytes)} · {formatDateAr(f.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ConfirmDeleteInline compact onConfirm={() => onDeleteFile(f.id)} />
                  </div>
                </div>

                {f.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {f.notes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ListTree className="w-3.5 h-3.5 text-blue-600" />
                    التسلسل السريع: {outlineCount > 0 ? `${outlineCount} عنصر` : 'متاح بالكليك يمين'}
                  </span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    كليك شمال للفتح
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Right-Click Fast Sequence Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden text-right"
        >
          <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ListTree className="w-3.5 h-3.5 text-blue-700" />
              التسلسل السريع للبحث
            </span>
            <button
              type="button"
              onClick={() => setContextMenu(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {contextMenu.file.sheetPreview && contextMenu.file.sheetPreview.length > 0 ? (
              contextMenu.file.sheetPreview.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onInspect({
                      kind: 'file',
                      id: contextMenu.file.id,
                      focusSearch: { query: s.sheetName, sheetIndex: idx },
                    });
                    setContextMenu(null);
                  }}
                  className="w-full text-right px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-800 dark:text-slate-200"
                >
                  ورقة: {s.sheetName}
                </button>
              ))
            ) : contextMenu.file.headings && contextMenu.file.headings.length > 0 ? (
              contextMenu.file.headings.map((h, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onInspect({
                      kind: 'file',
                      id: contextMenu.file.id,
                      focusSearch: { query: h, headingText: h },
                    });
                    setContextMenu(null);
                  }}
                  className="w-full text-right px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-800 dark:text-slate-200 truncate"
                >
                  {h}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => {
                  onInspect({ kind: 'file', id: contextMenu.file.id });
                  setContextMenu(null);
                }}
                className="w-full text-right px-3 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                فتح المستند بالكامل
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
