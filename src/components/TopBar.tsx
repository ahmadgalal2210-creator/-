import { useEffect, useRef, useState } from 'react';
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
  FolderPlus,
  HardDrive,
  HardDriveDownload,
  Image as ImageIcon,
  Loader2,
  Mail,
  Menu,
  Mic,
  Plus,
  Search,
  Send,
  Square,
  X,
} from 'lucide-react';
import {
  formatVoiceSeconds,
  useVoiceDictation,
} from '../hooks/useVoiceDictation';
import type { NavSection, ProjectFolder } from '../types';

export type QuickAddAction =
  | 'memo'
  | 'draft'
  | 'order'
  | 'correspondence'
  | 'entity'
  | 'file'
  | 'research'
  | 'image'
  | 'project';

interface TopBarProps {
  section: NavSection;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedProject: ProjectFolder | null;
  onClearProject: () => void;
  user: User | null;
  localMode: boolean;
  isOnline: boolean;
  hasPendingSync: boolean;
  onOpenMobileMenu: () => void;
  onQuickAdd: (kind: QuickAddAction) => void;
  onOpenOfflineModal: () => void;
  onOpenSyncModal: () => void;
  onReturnToPortal: () => void;
  onToast?: (msg: string) => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'الرئيسية — إدارة البيئة',
  external: 'مراسلات خارجية',
  sub_departments: 'الإدارات الفرعية للبيئة والسلامة',
  memos: 'مذكرات المصنع',
  drafts: 'مسودات العمل والملفات الخاصة',
  folders: 'إدارة المجلدات والتصنيفات',
  orders: 'مذكرة الأعمال والتكليفات',
  research: 'الأبحاث والدراسات العلمية',
  files: 'أرشيف الملفات والمستندات',
  images: 'أرشيف الصور والتوثيق الميداني',
  messages: 'الرسائل المحفوظة',
};

export function TopBar({
  section,
  searchQuery,
  onSearchChange,
  selectedProject,
  onClearProject,
  user,
  localMode,
  isOnline,
  hasPendingSync,
  onOpenMobileMenu,
  onQuickAdd,
  onOpenOfflineModal,
  onOpenSyncModal,
  onReturnToPortal,
  onToast,
}: TopBarProps) {
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const searchVoice = useVoiceDictation({
    onTranscript: (text) => {
      onSearchChange(text.replace(/[.،؟!]+$/g, '').trim());
    },
    onStatus: onToast,
  });

  useEffect(() => {
    if (!addOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [addOpen]);

  const quickActions: { id: QuickAddAction; label: string; icon: typeof FileText }[] = [
    { id: 'memo', label: 'مذكرة مصنع (وارد / صادر)', icon: Mail },
    { id: 'draft', label: 'إضافة مسودة (المصنع / خاص)', icon: FileEdit },
    { id: 'order', label: 'مذكرة أعمال وتكليف', icon: ClipboardCheck },
    { id: 'correspondence', label: 'مراسلة خارجية', icon: Send },
    { id: 'entity', label: 'إضافة جهة مراسلة', icon: Building2 },
    { id: 'file', label: 'رفع ملف (Word / Excel / PDF)', icon: FileText },
    { id: 'research', label: 'رفع بحث علمي / رسالة', icon: BookOpen },
    { id: 'image', label: 'إضافة صورة ميدانية', icon: ImageIcon },
    { id: 'project', label: 'إنشاء مجلد جديد', icon: FolderPlus },
  ];

  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title & Mobile Menu */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            aria-label="فتح القائمة"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-sm sm:text-base font-extrabold text-slate-950 dark:text-white truncate">
                {SECTION_TITLES[section]}
              </h2>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                السكرتارية
              </span>
              {selectedProject && (
                <button
                  type="button"
                  onClick={onClearProject}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold"
                >
                  <span>المجلد: {selectedProject.name}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search + Actions */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div className="relative flex-1 sm:w-64 lg:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="بحث فوري أو صوتي في الملفات والمذكرات..."
              className="w-full pr-9 pl-16 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="مسح البحث"
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                disabled={searchVoice.state === 'transcribing'}
                onClick={() => void searchVoice.toggle()}
                title={
                  searchVoice.state === 'recording'
                    ? `إيقاف البحث الصوتي (${formatVoiceSeconds(searchVoice.seconds)})`
                    : 'البحث بالأوامر الصوتية'
                }
                aria-label="البحث بالأوامر الصوتية"
                className={`p-1 rounded-md transition-colors disabled:opacity-70 ${
                  searchVoice.state === 'recording'
                    ? 'bg-red-600 text-white animate-pulse'
                    : searchVoice.state === 'transcribing'
                      ? 'bg-amber-500 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                {searchVoice.state === 'recording' ? (
                  <Square className="w-3 h-3 fill-current" />
                ) : searchVoice.state === 'transcribing' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSyncModal}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              hasPendingSync
                ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                : localMode
                  ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                  : 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
            }`}
          >
            {localMode ? (
              <HardDrive className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Cloud className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            )}
            <span>
              {hasPendingSync
                ? 'طلب المزامنة'
                : user && !localMode
                  ? 'أونلاين'
                  : 'غير متصل'}
            </span>
            <ArrowLeftRight className="w-3 h-3 opacity-70" />
          </button>

          <button
            type="button"
            onClick={onReturnToPortal}
            title="الرجوع إلى الصفحة الرئيسية (البوابة)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm"
          >
            <span>بوابة الخدمات</span>
          </button>

          <button
            type="button"
            onClick={onOpenOfflineModal}
            title="النسخ الاحتياطي وتصدير HTML أوفلاين"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <HardDriveDownload className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>أوفلاين / PWA</span>
          </button>

          {/* Quick Add Menu */}
          <div ref={addRef} className="relative">
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {addOpen && (
              <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl z-40 py-1.5 text-right">
                {quickActions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => {
                        setAddOpen(false);
                        onQuickAdd(act.id);
                      }}
                      className="w-full text-right px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <Icon className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                      <span>{act.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
