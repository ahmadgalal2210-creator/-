import { Edit3, FolderKanban, FolderOpen, FolderPlus } from 'lucide-react';
import { formatDateAr } from '../../lib/fileParser';
import type { ProjectFolder, WorkspaceState } from '../../types';
import { ConfirmDeleteInline } from '../ConfirmDeleteInline';
import { domainLabel } from '../DomainLabels';

interface FoldersViewProps {
  workspace: WorkspaceState;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onNewFolder: () => void;
  onEditFolder: (proj: ProjectFolder) => void;
  onDeleteFolder: (id: string) => Promise<void>;
}

export function FoldersView({
  workspace,
  selectedProjectId,
  onSelectProject,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
}: FoldersViewProps) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-extrabold text-slate-950 dark:text-white">
            إدارة المجلدات والتصنيفات ({workspace.projects.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            أنشئ مجلدات منظمة لربط الملفات والمذكرات والمسودات والصور وتصفيتها بسهولة
          </p>
        </div>
        <button
          type="button"
          onClick={onNewFolder}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
        >
          <FolderPlus className="w-4 h-4" />
          <span>مجلد جديد</span>
        </button>
      </div>

      {workspace.projects.length === 0 ? (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لا توجد مجلدات حالياً — اضغط «مجلد جديد» للبدء
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workspace.projects.map((p) => {
            const filesCount = workspace.files.filter((f) => f.projectId === p.id).length;
            const imgsCount = workspace.images.filter((i) => i.projectId === p.id).length;
            const memosCount = workspace.memos.filter((m) => m.projectId === p.id).length;
            const draftsCount = workspace.drafts.filter((d) => d.projectId === p.id).length;
            const ordersCount = workspace.orders.filter((o) => o.projectId === p.id).length;
            const active = selectedProjectId === p.id;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl bg-white dark:bg-slate-900 border transition-colors flex flex-col justify-between gap-3 ${
                  active
                    ? 'border-blue-600 ring-2 ring-blue-600/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] font-bold text-blue-700 dark:text-blue-400">
                        {p.code || 'ENV'} · {domainLabel(p.domain)}
                      </span>
                      <h4 className="font-display text-sm font-extrabold text-slate-950 dark:text-white mt-0.5 truncate">
                        {p.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditFolder(p)}
                        title="تعديل المجلد"
                        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <ConfirmDeleteInline compact onConfirm={() => onDeleteFolder(p.id)} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {p.description || 'مجلد لحفظ وتصنيف ملفات إدارة البيئة'}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                    <span>ملفات: {filesCount}</span>
                    <span>·</span>
                    <span>مذكرات: {memosCount}</span>
                    <span>·</span>
                    <span>مسودات: {draftsCount}</span>
                    <span>·</span>
                    <span>تكليفات: {ordersCount}</span>
                    <span>·</span>
                    <span>صور: {imgsCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{formatDateAr(p.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => onSelectProject(active ? null : p.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{active ? 'إلغاء التصفية' : 'تصفية بالمجلد'}</span>
                    </button>
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
