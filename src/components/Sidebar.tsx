import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeftRight,
  BookOpen,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Cloud,
  FileEdit,
  FileText,
  FolderKanban,
  FolderPlus,
  HardDrive,
  HardDriveDownload,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  Moon,
  Send,
  Sun,
  Trash2,
} from 'lucide-react';
import {
  SUB_DEPARTMENTS,
  type DraftScope,
  type MemoDirection,
  type NavSection,
  type ProjectFolder,
  type SubDepartmentId,
} from '../types';

interface SidebarProps {
  section: NavSection;
  externalFilterDirection: 'all' | MemoDirection;
  memoFilterDirection: MemoDirection;
  draftScopeFilter: 'all' | DraftScope;
  selectedSubDept: SubDepartmentId;
  selectedProjectId: string | null;
  projects: ProjectFolder[];
  counts: {
    correspondences: number;
    correspondencesIn: number;
    correspondencesOut: number;
    memosIn: number;
    memosOut: number;
    drafts: number;
    draftsFactory: number;
    draftsPrivate: number;
    ordersOpen: number;
    research: number;
    files: number;
    images: number;
    folders: number;
  };
  user: User | null;
  localMode: boolean;
  isOnline: boolean;
  hasPendingSync: boolean;
  darkMode: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectSection: (sec: NavSection) => void;
  onSelectExternalDirection: (dir: 'all' | MemoDirection) => void;
  onSelectSubDept: (subId: SubDepartmentId) => void;
  onSelectMemoDirection: (dir: MemoDirection) => void;
  onSelectDraftScope: (scope: 'all' | DraftScope) => void;
  onSelectProject: (projectId: string | null) => void;
  onNewFolder: () => void;
  onOpenSyncModal: () => void;
  onSwitchToOffline: () => void;
  onOpenOfflineModal: () => void;
  onOpenClearModal: () => void;
  onToggleDark: () => void;
  onSignOut: () => void;
}

export function Sidebar({
  section,
  externalFilterDirection,
  memoFilterDirection,
  draftScopeFilter,
  selectedSubDept,
  selectedProjectId,
  projects,
  counts,
  user,
  localMode,
  isOnline,
  hasPendingSync,
  darkMode,
  mobileOpen,
  onCloseMobile,
  onSelectSection,
  onSelectExternalDirection,
  onSelectSubDept,
  onSelectMemoDirection,
  onSelectDraftScope,
  onSelectProject,
  onNewFolder,
  onOpenSyncModal,
  onSwitchToOffline,
  onOpenOfflineModal,
  onOpenClearModal,
  onToggleDark,
  onSignOut,
}: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<{
    external: boolean;
    subDepts: boolean;
    memos: boolean;
    drafts: boolean;
  }>({
    external: section === 'external',
    subDepts: section === 'sub_departments',
    memos: section === 'memos',
    drafts: section === 'drafts',
  });

  const setMenuOpen = (key: keyof typeof openMenus, val: boolean) => {
    setOpenMenus((prev) => ({ ...prev, [key]: val }));
  };

  const toggleMenu = (key: keyof typeof openMenus) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navBtnClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
      active
        ? 'bg-blue-700 text-white shadow-xs'
        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
    }`;

  const subBtnClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
      active
        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  const sidebarContent = (
    <aside
      aria-label="القائمة الجانبية"
      className="no-print w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden"
    >
      {/* Header Brand */}
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-base font-extrabold text-slate-950 dark:text-white leading-tight">
              إدارة البيئة
            </h1>
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mt-0.5">
              السكرتارية
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              localMode
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
            }`}
          >
            {localMode ? 'أوفلاين' : isOnline ? 'سحابي' : 'محلي مؤقت'}
          </span>
        </div>
        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 pt-1">
          شركة الدقهلية لصناعة وتكرير السكر
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-1">
        <button
          type="button"
          onClick={() => {
            onSelectSection('overview');
            onCloseMobile();
          }}
          className={navBtnClass(section === 'overview' && !selectedProjectId)}
        >
          <span className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>الرئيسية</span>
          </span>
        </button>

        {/* Collapsible/Hover Dropdown: External Correspondence */}
        <div
          onMouseEnter={() => setMenuOpen('external', true)}
          onMouseLeave={() => {
            if (section !== 'external') setMenuOpen('external', false);
          }}
          className="space-y-1"
        >
          <button
            type="button"
            onClick={() => {
              toggleMenu('external');
              onSelectSection('external');
            }}
            className={navBtnClass(section === 'external')}
          >
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4 shrink-0" />
              <span>مراسلات خارجية</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] opacity-80 tabular-nums">
                {counts.correspondences}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  openMenus.external ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>

          {openMenus.external && (
            <div className="pr-4 space-y-1 border-r-2 border-slate-200 dark:border-slate-700 mr-3">
              <button
                type="button"
                onClick={() => {
                  onSelectExternalDirection('all');
                  onSelectSection('external');
                  onCloseMobile();
                }}
                className={subBtnClass(section === 'external' && externalFilterDirection === 'all')}
              >
                <span>الكل</span>
                <span className="font-mono text-[10px] tabular-nums">{counts.correspondences}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectExternalDirection('incoming');
                  onSelectSection('external');
                  onCloseMobile();
                }}
                className={subBtnClass(
                  section === 'external' && externalFilterDirection === 'incoming'
                )}
              >
                <span>الوارد</span>
                <span className="font-mono text-[10px] tabular-nums">{counts.correspondencesIn}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectExternalDirection('outgoing');
                  onSelectSection('external');
                  onCloseMobile();
                }}
                className={subBtnClass(
                  section === 'external' && externalFilterDirection === 'outgoing'
                )}
              >
                <span>الصادر</span>
                <span className="font-mono text-[10px] tabular-nums">{counts.correspondencesOut}</span>
              </button>
            </div>
          )}
        </div>

        {/* Collapsible/Hover Dropdown: Sub Departments */}
        <div
          onMouseEnter={() => setMenuOpen('subDepts', true)}
          onMouseLeave={() => {
            if (section !== 'sub_departments') setMenuOpen('subDepts', false);
          }}
          className="space-y-1"
        >
          <button
            type="button"
            onClick={() => {
              toggleMenu('subDepts');
              onSelectSection('sub_departments');
            }}
            className={navBtnClass(section === 'sub_departments')}
          >
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 shrink-0" />
              <span>الإدارات الفرعية</span>
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                openMenus.subDepts ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openMenus.subDepts && (
            <div className="pr-4 space-y-1 border-r-2 border-slate-200 dark:border-slate-700 mr-3">
              {SUB_DEPARTMENTS.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => {
                    onSelectSubDept(dept.id);
                    onSelectSection('sub_departments');
                    onCloseMobile();
                  }}
                  className={subBtnClass(
                    section === 'sub_departments' && selectedSubDept === dept.id
                  )}
                >
                  <span className="truncate">{dept.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Collapsible/Hover Dropdown: Factory Memos */}
        <div
          onMouseEnter={() => setMenuOpen('memos', true)}
          onMouseLeave={() => {
            if (section !== 'memos') setMenuOpen('memos', false);
          }}
          className="space-y-1"
        >
          <button
            type="button"
            onClick={() => {
              toggleMenu('memos');
              onSelectSection('memos');
            }}
            className={navBtnClass(section === 'memos')}
          >
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4 shrink-0" />
              <span>مذكرات المصنع</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] opacity-80 tabular-nums">
                {counts.memosIn + counts.memosOut}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  openMenus.memos ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>

          {openMenus.memos && (
            <div className="pr-4 space-y-1 border-r-2 border-slate-200 dark:border-slate-700 mr-3">
              <button
                type="button"
                onClick={() => {
                  onSelectMemoDirection('incoming');
                  onSelectSection('memos');
                  onCloseMobile();
                }}
                className={subBtnClass(section === 'memos' && memoFilterDirection === 'incoming')}
              >
                <span>الوارد</span>
                <span className="font-mono text-[10px] tabular-nums">{counts.memosIn}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectMemoDirection('outgoing');
                  onSelectSection('memos');
                  onCloseMobile();
                }}
                className={subBtnClass(section === 'memos' && memoFilterDirection === 'outgoing')}
              >
                <span>الصادر</span>
                <span className="font-mono text-[10px] tabular-nums">{counts.memosOut}</span>
              </button>
            </div>
          )}
        </div>

        {/* Collapsible/Hover Dropdown: Drafts (مسودات) */}
        <div
          onMouseEnter={() => setMenuOpen('drafts', true)}
          onMouseLeave={() => {
            if (section !== 'drafts') setMenuOpen('drafts', false);
          }}
          className="space-y-1"
        >
          <button
            type="button"
            onClick={() => {
              toggleMenu('drafts');
              onSelectSection('drafts');
            }}
            className={navBtnClass(section === 'drafts')}
          >
            <span className="flex items-center gap-2">
              <FileEdit className="w-4 h-4 shrink-0" />
              <span>مسودات</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] opacity-80 tabular-nums">
                {counts.drafts}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  openMenus.drafts ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>

          {openMenus.drafts && (
            <div className="pr-4 space-y-1 border-r-2 border-slate-200 dark:border-slate-700 mr-3">
              <button
                type="button"
                onClick={() => {
                  onSelectDraftScope('all');
                  onSelectSection('drafts');
                  onCloseMobile();
                }}
                className={subBtnClass(section === 'drafts' && draftScopeFilter === 'all')}
              >
                <span>الكل</span>
                <span className="font-mono text-[10px] tabular-nums">{counts.drafts}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectDraftScope('factory');
                  onSelectSection('drafts');
                  onCloseMobile();
                }}
                className={subBtnClass(section === 'drafts' && draftScopeFilter === 'factory')}
              >
                <span>المصنع</span>
                <span className="font-mono text-[10px] tabular-nums">{counts.draftsFactory}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectDraftScope('private');
                  onSelectSection('drafts');
                  onCloseMobile();
                }}
                className={subBtnClass(section === 'drafts' && draftScopeFilter === 'private')}
              >
                <span>خاص</span>
                <span className="font-mono text-[10px] tabular-nums">{counts.draftsPrivate}</span>
              </button>
            </div>
          )}
        </div>

        {/* Work Orders */}
        <button
          type="button"
          onClick={() => {
            onSelectSection('orders');
            onCloseMobile();
          }}
          className={navBtnClass(section === 'orders')}
        >
          <span className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 shrink-0" />
            <span>مذكرة الأعمال</span>
          </span>
          <span className="font-mono text-[10px] opacity-80 tabular-nums">{counts.ordersOpen}</span>
        </button>

        {/* Research & Studies */}
        <button
          type="button"
          onClick={() => {
            onSelectSection('research');
            onCloseMobile();
          }}
          className={navBtnClass(section === 'research')}
        >
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>الأبحاث والدراسات</span>
          </span>
          <span className="font-mono text-[10px] opacity-80 tabular-nums">{counts.research}</span>
        </button>

        {/* Files */}
        <button
          type="button"
          onClick={() => {
            onSelectSection('files');
            onCloseMobile();
          }}
          className={navBtnClass(section === 'files')}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0" />
            <span>الملفات</span>
          </span>
          <span className="font-mono text-[10px] opacity-80 tabular-nums">{counts.files}</span>
        </button>

        {/* Images */}
        <button
          type="button"
          onClick={() => {
            onSelectSection('images');
            onCloseMobile();
          }}
          className={navBtnClass(section === 'images')}
        >
          <span className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 shrink-0" />
            <span>الصور</span>
          </span>
          <span className="font-mono text-[10px] opacity-80 tabular-nums">{counts.images}</span>
        </button>

        {/* Folder Management */}
        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              onClick={() => {
                onSelectSection('folders');
                onCloseMobile();
              }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400"
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>المجلدات ({counts.folders})</span>
            </button>
            <button
              type="button"
              onClick={onNewFolder}
              title="إنشاء مجلد جديد"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100"
            >
              <FolderPlus className="w-3 h-3" />
              مجلد جديد
            </button>
          </div>

          {projects.slice(0, 6).map((proj) => (
            <button
              key={proj.id}
              type="button"
              onClick={() => {
                onSelectProject(selectedProjectId === proj.id ? null : proj.id);
                onCloseMobile();
              }}
              className={subBtnClass(selectedProjectId === proj.id)}
            >
              <span className="truncate">{proj.name}</span>
              {proj.code && (
                <span className="font-mono text-[10px] text-slate-400 shrink-0">{proj.code}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Bottom Controls & Doctor Profile */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/70 dark:bg-slate-950/70">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onOpenSyncModal}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
              hasPendingSync
                ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                : 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
            <span>{user ? 'المزامنة' : 'ربط جوجل'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenOfflineModal}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
          >
            <HardDriveDownload className="w-3.5 h-3.5 shrink-0" />
            <span>نسخ / HTML</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          {!localMode ? (
            <button
              type="button"
              onClick={onSwitchToOffline}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              <HardDrive className="w-3.5 h-3.5 text-amber-600" />
              <span>تحويل لأوفلاين</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
              <span>تحويل لأونلاين</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenClearModal}
            title="تفريغ الملفات مع حماية قاعدة البيانات"
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-[11px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>تفريغ</span>
          </button>

          <button
            type="button"
            onClick={onToggleDark}
            aria-label="تبديل المظهر"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Profile Footer */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
              د. أيمن عبد الحميد
            </p>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              دكتوراه في الكيمياء والسلامة المهنية
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={onSignOut}
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block h-dvh sticky top-0 shrink-0">{sidebarContent}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-dvh">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
