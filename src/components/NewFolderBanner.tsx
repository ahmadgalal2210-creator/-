import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileJson,
  FolderArchive,
  FolderCheck,
  FolderPlus,
  FolderSync,
  RefreshCw,
  X,
} from 'lucide-react';
import type { FolderConnectionInfo } from '../lib/folderStorageService';

interface NewFolderBannerProps {
  folderInfo: FolderConnectionInfo;
  isStandaloneOffline: boolean;
  onConnectFolder: () => Promise<void>;
  onReconnectFolder: () => Promise<void>;
  onDownloadZipFolder: () => Promise<void>;
  onDownloadDbJson: () => void;
  onImportFolderFiles: (files: FileList) => Promise<void>;
}

export function NewFolderBanner({
  folderInfo,
  isStandaloneOffline,
  onConnectFolder,
  onReconnectFolder,
  onDownloadZipFolder,
  onDownloadDbJson,
  onImportFolderFiles,
}: NewFolderBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirInputRef = useRef<HTMLInputElement>(null);

  if (dismissed) return null;

  const isConnected = folderInfo.status === 'connected';
  const needsPerm = folderInfo.status === 'needs_permission';

  // On online/PWA mode only show when connected or needs permission or explicitly standalone offline
  if (!isStandaloneOffline && !isConnected && !needsPerm) {
    return null;
  }

  return (
    <div
      className={`mb-4 p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
        isConnected
          ? 'bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-900'
          : 'bg-amber-50/90 dark:bg-amber-950/35 border-amber-200 dark:border-amber-900'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {isConnected ? (
          <FolderCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <FolderSync className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="text-xs space-y-0.5">
          <p className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
            <span>
              {isConnected
                ? `مجلد المرجع «${folderInfo.folderName}» متصل ويعمل تلقائياً`
                : needsPerm
                  ? `إعادة ربط مجلد المرجع «${folderInfo.folderName}»`
                  : 'توليد وربط مجلد المرجع (new folder) لتخفيف الصفحة وحفظ قاعدة البيانات'}
            </span>
            {isConnected && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3" />
                حفظ تلقائي نشط
              </span>
            )}
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {isConnected
              ? 'يتم حفظ قاعدة البيانات (database.json) وجميع الملفات (files/) والصور (images/) تلقائياً داخل المجلد المرجعي حتى تظل الصفحة خفيفة وسريعة.'
              : folderInfo.supportsDirectPicker
                ? 'اضغط لتوليد مجلد «new folder» على جهازك ليصبح مرجع قاعدة البيانات والملفات بدلاً من تضخم صفحة HTML.'
                : 'بسبب فتح الصفحة محلياً (file://)، يتم الحفظ الفوري في قاعدة البيانات المحلية الخفيفة (IndexedDB)، ويمكنك توليد مجلد «new folder» أو ربطه بنقرة واحدة من الأزرار المجاورة.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <input
          ref={dirInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is standard in Chromium/Firefox/Safari
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={async (e) => {
            const list = e.target.files;
            if (!list || list.length === 0) return;
            setBusy(true);
            try {
              await onImportFolderFiles(list);
            } finally {
              e.target.value = '';
              setBusy(false);
            }
          }}
        />

        {needsPerm && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onReconnectFolder();
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>إعادة ربط {folderInfo.folderName}</span>
          </button>
        )}

        {folderInfo.supportsDirectPicker && !isConnected && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConnectFolder();
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>توليد وربط مجلد (new folder)</span>
          </button>
        )}

        {!folderInfo.supportsDirectPicker && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDownloadZipFolder();
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>توليد مجلد (new folder.zip)</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDownloadDbJson}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50"
            >
              <FileJson className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>تحديث database.json</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => dirInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>فتح مجلد (new folder)</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="إخفاء الشريط"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
