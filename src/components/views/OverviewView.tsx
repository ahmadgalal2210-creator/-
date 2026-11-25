import {
  BookOpen,
  Building2,
  ClipboardCheck,
  FileEdit,
  FileText,
  FolderKanban,
  Mail,
  Send,
} from 'lucide-react';
import { formatDateAr } from '../../lib/fileParser';
import { SUB_DEPARTMENTS } from '../../types';
import type {
  InspectedItem,
  NavSection,
  SubDepartmentId,
  WorkspaceState,
} from '../../types';
import { CategoryIcon } from '../DomainLabels';

interface OverviewViewProps {
  workspace: WorkspaceState;
  onNavigate: (sec: NavSection) => void;
  onSelectSubDept: (id: SubDepartmentId) => void;
  onInspect: (item: InspectedItem) => void;
}

export function OverviewView({
  workspace,
  onNavigate,
  onSelectSubDept,
  onInspect,
}: OverviewViewProps) {
  const stats = [
    {
      label: 'مراسلات خارجية',
      value: workspace.correspondences.length,
      icon: Send,
      section: 'external' as NavSection,
      accent: 'text-blue-700 dark:text-blue-400',
    },
    {
      label: 'مذكرات المصنع',
      value: workspace.memos.length,
      icon: Mail,
      section: 'memos' as NavSection,
      accent: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'مسودات العمل',
      value: workspace.drafts.length,
      icon: FileEdit,
      section: 'drafts' as NavSection,
      accent: 'text-indigo-700 dark:text-indigo-400',
    },
    {
      label: 'مذكرة الأعمال',
      value: workspace.orders.filter((o) => o.status !== 'done').length,
      icon: ClipboardCheck,
      section: 'orders' as NavSection,
      accent: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: 'الأبحاث والدراسات',
      value: workspace.files.filter((f) => f.researchKind && f.researchKind !== 'none').length,
      icon: BookOpen,
      section: 'research' as NavSection,
      accent: 'text-rose-700 dark:text-rose-400',
    },
    {
      label: 'المجلدات والملفات',
      value: workspace.projects.length,
      icon: FolderKanban,
      section: 'folders' as NavSection,
      accent: 'text-slate-700 dark:text-slate-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
            شركة الدقهلية لصناعة وتكرير السكر — الإدارة العامة للبيئة والسلامة المهنية
          </p>
          <h2 className="font-display text-xl font-extrabold text-slate-950 dark:text-white mt-1">
            منظومة إدارة البيئة — السكرتارية
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            د. أيمن عبد الحميد — دكتوراه في الكيمياء والسلامة المهنية
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('memos')}
            className="px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
          >
            مذكرات المصنع
          </button>
          <button
            type="button"
            onClick={() => onNavigate('drafts')}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
          >
            مسودات العمل
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {stats.map((st) => {
          const Icon = st.icon;
          return (
            <button
              key={st.label}
              type="button"
              onClick={() => onNavigate(st.section)}
              className="text-right p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {st.label}
                </span>
                <Icon className={`w-4 h-4 ${st.accent}`} />
              </div>
              <p className="font-mono text-2xl font-extrabold text-slate-950 dark:text-white mt-2 tabular-nums">
                {st.value}
              </p>
            </button>
          );
        })}
      </div>

      {/* Sub-departments quick grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            الإدارات الفرعية التابعة لإدارة البيئة
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('sub_departments')}
            className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline"
          >
            عرض الكل
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {SUB_DEPARTMENTS.map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => {
                onSelectSubDept(dept.id);
                onNavigate('sub_departments');
              }}
              className="text-right p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-extrabold text-slate-900 dark:text-white">
                  {dept.name}
                </span>
                <span className="font-mono text-[10px] text-slate-400">{dept.code}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                {dept.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Memos & Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              أحدث مذكرات المصنع
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('memos')}
              className="text-xs font-bold text-blue-700 dark:text-blue-400"
            >
              فتح الكل
            </button>
          </div>
          {workspace.memos.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">لا توجد مذكرات حالياً.</p>
          ) : (
            <div className="space-y-2">
              {workspace.memos.slice(0, 4).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onInspect({ kind: 'memo', id: m.id })}
                  className="w-full text-right p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 hover:border-blue-400 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {m.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {m.departmentName || 'إدارة البيئة'} · {formatDateAr(m.updatedAt)}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold shrink-0">
                    {m.direction === 'incoming' ? 'وارد' : 'صادر'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-700" />
              أحدث الملفات والأبحاث
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('files')}
              className="text-xs font-bold text-blue-700 dark:text-blue-400"
            >
              فتح الكل
            </button>
          </div>
          {workspace.files.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">لا توجد ملفات مرفوعة حالياً.</p>
          ) : (
            <div className="space-y-2">
              {workspace.files.slice(0, 4).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onInspect({ kind: 'file', id: f.id })}
                  className="w-full text-right p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 hover:border-blue-400 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CategoryIcon category={f.category} className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {f.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{f.fileName}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatDateAr(f.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
