import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileCode2,
  FileJson,
  HardDriveDownload,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import type { FolderConnectionInfo } from '../lib/folderStorageService';
import {
  downloadWorkspaceBackupJson,
  loadAutoRecoverySnapshot,
  parseWorkspaceBackupJson,
} from '../lib/localWorkspaceService';
import {
  buildStandaloneOfflineHtml,
  getManifestJsonString,
  primeOfflineDownloadCache,
  triggerBlobDownload,
} from '../lib/offlineHtmlExporter';
import { isStandaloneOfflineMode } from '../lib/offlineRuntime';
import type { WorkspaceState } from '../types';

interface OfflineDownloadModalProps {
  open: boolean;
  workspace: WorkspaceState;
  folderInfo: FolderConnectionInfo;
  onConnectNewFolder: () => Promise<void>;
  onReconnectNewFolder: () => Promise<void>;
  onDownloadNewFolderZip: () => Promise<void>;
  onDownloadDbJson: () => void;
  onImportNewFolderFiles: (files: FileList) => Promise<void>;
  onClose: () => void;
  onImportBackup: (ws: WorkspaceState) => Promise<void>;
  onOpenClearModal: () => void;
  onToast: (msg: string) => void;
}

export function OfflineDownloadModal({
  open,
  workspace,
  onClose,
  onImportBackup,
  onOpenClearModal,
  onToast,
}: OfflineDownloadModalProps) {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [busyAction, setBusyAction] = useState<'pwa' | 'code' | 'restore' | null>(null);
  const [installHint, setInstallHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const standaloneOffline = isStandaloneOfflineMode();
  const appRootHref =
    typeof window !== 'undefined' &&
    !standaloneOffline &&
    /^https?:$/i.test(window.location.protocol)
      ? `${window.location.origin}/`
      : null;

  useEffect(() => {
    if (open && isOnline && !standaloneOffline) {
      void primeOfflineDownloadCache();
    }
  }, [open, isOnline, standaloneOffline]);

  if (!open) return null;

  const busy = busyAction !== null;

  const handleDownloadPwaFile = async () => {
    setBusyAction('pwa');
    try {
      const html = await buildStandaloneOfflineHtml(workspace, {
        pwaEnhanced: true,
      });
      triggerBlobDownload(
        html,
        `إدارة_البيئة_PWA_${new Date().toISOString().slice(0, 10)}.html`,
        'text/html;charset=utf-8'
      );
      onToast(
        isOnline
          ? 'تم تحميل ملف الـ PWA بنجاح (يعمل أونلاين وأوفلاين)'
          : 'تم تحميل ملف الـ PWA في وضع الأوفلاين بنجاح'
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'تعذر تجهيز ملف الـ PWA للتحميل'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleInstallOrDownloadPwa = async () => {
    if (canInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        onToast('تم تثبيت «إدارة البيئة» كتطبيق PWA مستقل على جهازك');
        return;
      }
    }
    setInstallHint(true);
    await handleDownloadPwaFile();
  };

  const handleDownloadManifest = async () => {
    try {
      const manifestJson = await getManifestJsonString();
      triggerBlobDownload(
        manifestJson,
        'manifest.webmanifest',
        'application/manifest+json;charset=utf-8'
      );
      onToast('تم تحميل ملف تعريف التطبيق (manifest.webmanifest)');
    } catch {
      onToast('تعذر تحميل ملف التعريف');
    }
  };

  const handleDownloadOfflineHtml = async () => {
    setBusyAction('code');
    try {
      const html = await buildStandaloneOfflineHtml(workspace);
      triggerBlobDownload(
        html,
        `إدارة_البيئة_أوفلاين_${new Date().toISOString().slice(0, 10)}.html`,
        'text/html;charset=utf-8'
      );
      onToast('تم تحميل صفحة العمل الأوفلاين المطابقة للأونلاين (.html)');
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'تعذر تجهيز ملف الصفحة الأوفلاين'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreAutoSnapshot = async () => {
    setBusyAction('restore');
    try {
      const snap = await loadAutoRecoverySnapshot();
      if (!snap) {
        onToast('لا توجد نسخة حماية تلقائية محفوظة بعد');
        return;
      }
      await onImportBackup(snap.workspace);
      onToast(`تم استرداد نسخة الحماية (${snap.label})`);
      onClose();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/45"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDriveDownload className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                النسخ الاحتياطية
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* 1. PWA File & App Download (Online & Offline) */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50/45 dark:bg-blue-950/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      تحميل ملف الـ PWA
                    </h3>
                    {isInstalled && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        مثبّت كتطبيق
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {canInstall
                      ? 'تثبيت التطبيق مباشرة على الجهاز للعمل أونلاين وأوفلاين'
                      : 'نسخة تطبيق الويب المتقدم (PWA) — تعمل أونلاين وأوفلاين'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleInstallOrDownloadPwa()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 shrink-0 disabled:opacity-60 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {busyAction === 'pwa' ? 'جاري التجهيز...' : 'تحميل'}
              </button>
            </div>

            <div className="pt-2 border-t border-blue-200/70 dark:border-blue-900/60 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {appRootHref && (
                <a
                  href={appRootHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>فتح رابط التثبيت المباشر</span>
                </a>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDownloadPwaFile()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 hover:underline disabled:opacity-60"
              >
                <Download className="w-3 h-3" />
                <span>تحميل ملف PWA أوفلاين (.html)</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadManifest()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
              >
                <FileJson className="w-3 h-3" />
                <span>manifest.webmanifest</span>
              </button>
            </div>

            {(installHint || isIOS) && !isInstalled && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 border border-blue-100 dark:border-blue-900/50 rounded-lg px-3 py-2">
                {isIOS
                  ? 'لتثبيت التطبيق على iPhone أو iPad: افتح رابط التثبيت المباشر في متصفح Safari ثم اختر «مشاركة» ← «إضافة إلى الشاشة الرئيسية».'
                  : 'لتثبيت الـ PWA كتطبيق مستقل على الجهاز: افتح «رابط التثبيت المباشر» في المتصفح ثم اضغط أيقونة التثبيت في شريط العنوان، أو افتح ملف الـ PWA المحمّل مباشرة في وضع الأوفلاين.'}
              </p>
            )}
          </div>

          {/* 2. Standalone Offline HTML (Exact Online React Bundle) */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileCode2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  تحميل ملف الكود
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  ملف تشغيل مستقل بجميع البيانات (يعمل أونلاين وأوفلاين)
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDownloadOfflineHtml()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 shrink-0 disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              {busyAction === 'code' ? 'جاري التجهيز...' : 'تحميل'}
            </button>
          </div>

          {/* 3. JSON Backup & Restore */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                النسخ الاحتياطية
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  downloadWorkspaceBackupJson(workspace);
                  onToast('تم تحميل النسخة الاحتياطية بنجاح');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                النسخ الاحتياطية
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setBusyAction('restore');
                  try {
                    const parsed = await parseWorkspaceBackupJson(file);
                    await onImportBackup(parsed);
                    onToast('تم استرداد النسخة الاحتياطية بنجاح');
                    onClose();
                  } catch {
                    onToast('ملف النسخة الاحتياطية غير صالح');
                  } finally {
                    setBusyAction(null);
                  }
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Upload className="w-3.5 h-3.5" />
                استرداد نسخة احتياطية (.json)
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRestoreAutoSnapshot()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-semibold"
              >
                استعادة آخر نسخة تلقائية
              </button>
            </div>
          </div>

          {/* 4. Clear Workspace Trigger */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              لتفريغ الملفات مع التأكيد المزدوج لحفظ قاعدة البيانات
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenClearModal();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              تفريغ الملفات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
