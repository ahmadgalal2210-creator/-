import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  ExternalLink,
  FileJson,
  HardDrive,
  Link2,
  LogOut,
  RefreshCw,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { formatDateAr } from '../lib/fileParser';
import {
  formatFirebaseAuthErrorAr,
  getDriveAccessToken,
  hasFirestoreConfigured,
  isFirebaseAuthAvailable,
} from '../lib/firebase';
import {
  preloadGoogleGis,
  requestDriveAccessTokenViaGis,
} from '../lib/googleOAuthFallback';
import {
  DRIVE_SYNC_FILENAME,
  readWorkspaceFromDrive,
} from '../lib/googleDriveService';
import {
  countWorkspaceItems,
  loadLocalWorkspace,
  parseWorkspaceBackupJson,
} from '../lib/localWorkspaceService';
import {
  getCloudSyncOrigin,
  isFileProtocolMode,
} from '../lib/offlineRuntime';
import { mergeWorkspaces, type SyncDiffSummary } from '../lib/syncEngine';
import { fetchCloudWorkspaceOnce } from '../lib/workspaceService';
import type { WorkspaceState } from '../types';
import {
  decodeDriveBridgeCode,
  type DriveBridgePayload,
} from './DriveBridgeView';

export type SyncStrategy = 'merge' | 'push_local' | 'pull_cloud';

interface SyncModalProps {
  open: boolean;
  user: User | null;
  localMode: boolean;
  isOnline: boolean;
  hasPendingSync: boolean;
  lastSyncedAt: string | null;
  linkedHint: { email: string; displayName: string } | null;
  workspace: WorkspaceState;
  onClose: () => void;
  onLinkGoogle: () => Promise<User | null>;
  onApplyBridgeAuth: (payload: DriveBridgePayload) => User;
  onExecuteSync: (
    strategy: SyncStrategy,
    targetUser: User,
    localWs: WorkspaceState,
    cloudWs: WorkspaceState
  ) => Promise<void>;
  onCleanCloudForDev: (targetUser: User, cloudWs: WorkspaceState) => Promise<void>;
  onSwitchToOffline: () => Promise<void>;
  onSwitchToOnline: () => void;
  onMergeImportedJson: (imported: WorkspaceState) => Promise<void>;
  onSignOutGoogle: () => Promise<void>;
  onToast: (msg: string) => void;
}

export function SyncModal({
  open,
  user,
  localMode,
  isOnline,
  hasPendingSync,
  lastSyncedAt,
  linkedHint,
  workspace,
  onClose,
  onLinkGoogle,
  onApplyBridgeAuth,
  onExecuteSync,
  onCleanCloudForDev,
  onSwitchToOffline,
  onSwitchToOnline,
  onMergeImportedJson,
  onSignOutGoogle,
  onToast,
}: SyncModalProps) {
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [localWs, setLocalWs] = useState<WorkspaceState | null>(null);
  const [cloudWs, setCloudWs] = useState<WorkspaceState | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SyncDiffSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showBridgePanel, setShowBridgePanel] = useState(false);
  const [bridgeCodeInput, setBridgeCodeInput] = useState('');
  const [queuedStrategy, setQueuedStrategy] = useState<SyncStrategy | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<
    null | { kind: 'push_local' | 'clean_cloud'; title: string; detail: string }
  >(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const bridgeAnchorRef = useRef<HTMLAnchorElement>(null);

  const fileProtocol = isFileProtocolMode();
  const driveToken = getDriveAccessToken();
  const defaultCloudOrigin = getCloudSyncOrigin();
  const [customCloudOrigin, setCustomCloudOrigin] = useState<string>('');
  const [showOriginEditor, setShowOriginEditor] = useState(false);
  const activeCloudOrigin = (customCloudOrigin.trim() || defaultCloudOrigin).replace(/\/+$/, '');
  const driveBridgeUrl = `${activeCloudOrigin}/?drive_bridge=1`;

  const inspectBothSides = async (
    activeUser: User | null,
    currentLocal?: WorkspaceState
  ) => {
    setErrorMsg(null);
    const localData =
      currentLocal || (localMode ? workspace : await loadLocalWorkspace());
    setLocalWs(localData);

    const token = getDriveAccessToken();
    if (!activeUser || (!token && !hasFirestoreConfigured)) {
      setCloudWs(null);
      setSummary(null);
      setDriveFileId(null);
      return null;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setCloudWs(null);
      setSummary(null);
      setDriveFileId(null);
      return null;
    }

    setLoadingCloud(true);
    try {
      let cloudData: WorkspaceState;
      if (token) {
        const driveRes = await readWorkspaceFromDrive(token);
        cloudData = driveRes.workspace;
        setDriveFileId(driveRes.fileId);
      } else {
        cloudData = await fetchCloudWorkspaceOnce(activeUser.uid);
        setDriveFileId(null);
      }
      setCloudWs(cloudData);
      const { summary: s } = mergeWorkspaces(localData, cloudData, true);
      setSummary(s);
      return { localData, cloudData };
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر قراءة بيانات جوجل درايف حالياً — تأكد من الاتصال بالإنترنت وحاول مجدداً.'
      );
      return null;
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setPendingConfirm(null);
      setShowBridgePanel(false);
      return;
    }
    if (!fileProtocol && isOnline) {
      void preloadGoogleGis().catch(() => {
        // non-blocking preload
      });
    }
    void inspectBothSides(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.uid, driveToken, isOnline, localMode]);

  // If the user received a Drive Bridge token while the modal is open, inspect & sync immediately
  useEffect(() => {
    if (!open || !user || !driveToken) return;
    if (showBridgePanel || fileProtocol || queuedStrategy) {
      setShowBridgePanel(false);
      const strategyToRun = queuedStrategy;
      setQueuedStrategy(null);
      if (strategyToRun) {
        void executeSyncWithUser(strategyToRun, user);
      } else {
        void inspectBothSides(user);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.uid, driveToken]);

  // Auto-resume queued sync as soon as internet comes back
  useEffect(() => {
    if (!open || !isOnline || !queuedStrategy) return;
    const strategy = queuedStrategy;
    setQueuedStrategy(null);
    void executeSyncInternal(strategy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isOnline]);

  if (!open) return null;

  const localDisplayCount = localWs
    ? countWorkspaceItems(localWs)
    : countWorkspaceItems(workspace);

  const executeSyncWithUser = async (
    strategy: SyncStrategy,
    activeUser: User
  ) => {
    setSyncing(true);
    setErrorMsg(null);
    try {
      const lData =
        localWs || (localMode ? workspace : await loadLocalWorkspace());
      let cData = cloudWs;
      if (!cData) {
        const freshToken = getDriveAccessToken();
        if (freshToken) {
          const driveRes = await readWorkspaceFromDrive(freshToken);
          cData = driveRes.workspace;
          setDriveFileId(driveRes.fileId);
        } else {
          cData = await fetchCloudWorkspaceOnce(activeUser.uid);
        }
      }
      await onExecuteSync(strategy, activeUser, lData, cData);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'حدث خطأ أثناء تنفيذ المزامنة.'
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectGoogle = async (pendingStrategyAfterLink?: SyncStrategy) => {
    // In file:// local HTML files, Firebase popup requires the HTTPS Drive Bridge window
    if (fileProtocol || !isFirebaseAuthAvailable) {
      setErrorMsg(null);
      if (pendingStrategyAfterLink) {
        setQueuedStrategy(pendingStrategyAfterLink);
      }
      setShowBridgePanel(true);
      if (typeof navigator === 'undefined' || navigator.onLine) {
        bridgeAnchorRef.current?.click();
        onToast(
          'تم فتح نافذة الاتصال بالسحابة — أكمل تسجيل الدخول بجوجل وسيتم الربط تلقائياً (أو انسخ رمز الربط وألصقه بالأسفل).'
        );
      }
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (pendingStrategyAfterLink) {
        setQueuedStrategy(pendingStrategyAfterLink);
      }
      setShowBridgePanel(true);
      setErrorMsg(
        'الجهاز غير متصل بالإنترنت حالياً — تم تجهيز نافذة الربط، وسيتم الاتصال بجوجل درايف فور توفر الإنترنت.'
      );
      return;
    }

    setLinking(true);
    setErrorMsg(null);
    try {
      const linkedUser = await onLinkGoogle();
      if (linkedUser && getDriveAccessToken()) {
        onToast(
          `تم ربط حساب جوجل درايف: ${linkedUser.email || 'د. أيمن عبد الحميد'} — جاري فحص الملف السحابي...`
        );
        if (pendingStrategyAfterLink) {
          await executeSyncWithUser(pendingStrategyAfterLink, linkedUser);
          return;
        }
        const inspected = await inspectBothSides(linkedUser, localWs || workspace);
        if (
          inspected &&
          countWorkspaceItems(inspected.localData) === 0 &&
          countWorkspaceItems(inspected.cloudData) > 0
        ) {
          await onExecuteSync(
            'pull_cloud',
            linkedUser,
            inspected.localData,
            inspected.cloudData
          );
          onClose();
        }
      } else {
        if (pendingStrategyAfterLink) {
          setQueuedStrategy(pendingStrategyAfterLink);
        }
        setShowBridgePanel(true);
      }
    } catch (err) {
      const msg = formatFirebaseAuthErrorAr(err);
      setErrorMsg(msg);
      const raw = err instanceof Error ? err.message : String(err || '');
      if (
        raw.includes('popup-blocked') ||
        raw.includes('popup-closed-by-user') ||
        raw.includes('cancelled-popup-request') ||
        raw.includes('unauthorized-domain') ||
        raw.includes('operation-not-supported') ||
        raw.includes('internal-error')
      ) {
        if (pendingStrategyAfterLink) {
          setQueuedStrategy(pendingStrategyAfterLink);
        }
        setShowBridgePanel(true);
      }
    } finally {
      setLinking(false);
    }
  };

  const handleDirectGisConnect = async () => {
    if (fileProtocol) {
      setShowBridgePanel(true);
      return;
    }
    setLinking(true);
    setErrorMsg(null);
    try {
      const gisRes = await requestDriveAccessTokenViaGis();
      const linked = onApplyBridgeAuth({
        type: 'DAKAHLIA_DRIVE_BRIDGE_AUTH',
        token: gisRes.token,
        email: gisRes.email,
        displayName: gisRes.displayName,
        uid: gisRes.uid,
      });
      setShowBridgePanel(false);
      const strategyToRun = queuedStrategy;
      setQueuedStrategy(null);
      onToast(`تم ربط جوجل درايف لحساب ${linked.email || linked.displayName}`);
      if (strategyToRun) {
        await executeSyncWithUser(strategyToRun, linked);
      } else {
        await inspectBothSides(linked, localWs || workspace);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر فتح نافذة المصادقة المباشرة مع جوجل.'
      );
    } finally {
      setLinking(false);
    }
  };

  const handleApplyPastedBridgeCode = async () => {
    const parsed = decodeDriveBridgeCode(bridgeCodeInput);
    if (!parsed) {
      setErrorMsg('رمز الربط غير صحيح. انسخ الرمز كاملاً من نافذة جوجل درايف.');
      return;
    }
    const linked = onApplyBridgeAuth(parsed);
    setBridgeCodeInput('');
    setShowBridgePanel(false);
    const strategyToRun = queuedStrategy || 'merge';
    setQueuedStrategy(null);
    onToast(`تم ربط جوجل درايف لحساب ${linked.email || linked.displayName}`);
    await executeSyncWithUser(strategyToRun, linked);
  };

  const executeSyncInternal = async (strategy: SyncStrategy) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setQueuedStrategy(strategy);
      setShowBridgePanel(true);
      setErrorMsg(
        'الجهاز غير متصل بالإنترنت حالياً — تم حفظ طلب المزامنة وتجهيز نافذة الربط بجوجل درايف فور عودة الاتصال.'
      );
      return;
    }

    let activeUser = user;
    if (!activeUser || !getDriveAccessToken()) {
      await handleConnectGoogle(strategy);
      return;
    }

    await executeSyncWithUser(strategy, activeUser);
  };

  const handleRunSync = (strategy: SyncStrategy) => {
    if (strategy === 'push_local' && cloudWs && countWorkspaceItems(cloudWs) > 0) {
      setPendingConfirm({
        kind: 'push_local',
        title: 'تأكيد تحديث ملف جوجل درايف',
        detail: `سيتم تحديث واستبدال محتوى ملف «${DRIVE_SYNC_FILENAME}» على جوجل درايف (${countWorkspaceItems(cloudWs)} عنصر حالياً) بنسخة جهازك المحلية (${localDisplayCount} عنصر).`,
      });
      return;
    }
    void executeSyncInternal(strategy);
  };

  const executeCleanCloudInternal = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMsg('يجب الاتصال بالإنترنت وربط حساب جوجل درايف لتنظيف السحابة.');
      return;
    }
    let activeUser: User | null = user;
    if (!activeUser || (!getDriveAccessToken() && !hasFirestoreConfigured)) {
      if (fileProtocol || !isFirebaseAuthAvailable) {
        setShowBridgePanel(true);
        return;
      }
      setLinking(true);
      try {
        activeUser = await onLinkGoogle();
      } catch (err) {
        setErrorMsg(formatFirebaseAuthErrorAr(err));
        setLinking(false);
        return;
      }
      setLinking(false);
      if (!activeUser) return;
    }

    setSyncing(true);
    setErrorMsg(null);
    try {
      const token = getDriveAccessToken();
      let cData = cloudWs;
      if (!cData) {
        cData = token
          ? (await readWorkspaceFromDrive(token)).workspace
          : await fetchCloudWorkspaceOnce(activeUser.uid);
      }
      await onCleanCloudForDev(activeUser, cData);
      await inspectBothSides(activeUser);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر تفريغ البيانات التجريبية في جوجل درايف.'
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleCleanCloud = () => {
    setPendingConfirm({
      kind: 'clean_cloud',
      title: 'تأكيد تنظيف الملف السحابي على جوجل درايف',
      detail: `سيتم حذف العناصر النموذجية والمسودات الفارغة والرسائل المقروءة من ملف «${DRIVE_SYNC_FILENAME}» على جوجل درايف مع الإبقاء على بياناتك الفعلية.`,
    });
  };

  const handleJsonMergeUpload = async (file: File) => {
    setSyncing(true);
    setErrorMsg(null);
    try {
      const parsed = await parseWorkspaceBackupJson(file);
      await onMergeImportedJson(parsed);
      onToast('تم دمج ملف الأوفلاين مع مساحة العمل بنجاح');

      if (isOnline) {
        try {
          let activeUser = user;
          if ((!activeUser || !getDriveAccessToken()) && isFirebaseAuthAvailable) {
            activeUser = await onLinkGoogle();
          }
          if (activeUser && (getDriveAccessToken() || hasFirestoreConfigured)) {
            const lData = await loadLocalWorkspace();
            let cData = cloudWs;
            if (!cData) {
              const freshToken = getDriveAccessToken();
              if (freshToken) {
                const driveRes = await readWorkspaceFromDrive(freshToken);
                cData = driveRes.workspace;
                setDriveFileId(driveRes.fileId);
              } else {
                cData = await fetchCloudWorkspaceOnce(activeUser.uid);
              }
            }
            await onExecuteSync('merge', activeUser, lData, cData);
            onToast('تم دمج ورفع البيانات المحدثة إلى جوجل درايف بنجاح');
          }
        } catch {
          // Fallback if cloud push prompt was cancelled or failed
        }
      }

      await inspectBothSides(user);
    } catch {
      setErrorMsg('تعذر قراءة ملف الأوفلاين (.json). تأكد أنه ملف نسخة صالحة.');
    } finally {
      setSyncing(false);
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
            <ArrowLeftRight className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                المزامنة والربط مع جوجل درايف (أونلاين ⇄ أوفلاين)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ربط ملف قاعدة البيانات مع جوجل درايف وسحبه أو مزامنته في أي وقت
              </p>
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
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'حساب جوجل'}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                    {user ? <Cloud className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user
                      ? `مرتبط بحساب جوجل: ${user.email || user.displayName}`
                      : linkedHint
                        ? `آخر حساب جوجل مرتبط: ${linkedHint.email}`
                        : 'يعمل حالياً في وضع الأوفلاين المحلي — جاهز للربط بجوجل درايف'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                    <span>
                      الوضع النشط:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {localMode
                          ? 'وضع الأوفلاين (جهازك)'
                          : 'وضع الأونلاين (جوجل درايف)'}
                      </strong>
                    </span>
                    {driveFileId && (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        · ملف جوجل درايف متصل
                      </span>
                    )}
                    {lastSyncedAt && (
                      <span>· آخر مزامنة: {formatDateAr(lastSyncedAt)}</span>
                    )}
                  </p>
                </div>
              </div>

              {!user || !driveToken ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={linking}
                    onClick={() => void handleConnectGoogle()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 disabled:opacity-60"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {linking
                      ? 'جاري فتح نافذة جوجل...'
                      : user
                        ? 'اختيار / تفعيل حساب جوجل درايف'
                        : 'اختيار حساب جوجل درايف والمزامنة'}
                  </button>
                  {linking && (
                    <button
                      type="button"
                      onClick={() => {
                        setLinking(false);
                        setShowBridgePanel(true);
                      }}
                      className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      استخدام نافذة الربط البديلة
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void inspectBothSides(user)}
                    disabled={loadingCloud}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loadingCloud ? 'animate-spin' : ''}`}
                    />
                    فحص جوجل درايف
                  </button>
                  <button
                    type="button"
                    disabled={linking}
                    onClick={() => void handleConnectGoogle()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    تبديل الحساب
                  </button>
                </div>
              )}
            </div>

            {!isOnline && (
              <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <span>
                    الجهاز غير متصل بالإنترنت حالياً — كل تعديلاتك محفوظة محلياً، ويمكنك الضغط لطلب المزامنة أو فتح نافذة الربط بجوجل درايف فور عودة الاتصال.
                  </span>
                </div>
              </div>
            )}

            {user && !driveToken && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                <span>
                  اضغط «اختيار / تفعيل حساب جوجل درايف» لمنح الجلسة الحالية إذن قراءة وحفظ الملف على جوجل درايف.
                </span>
              </div>
            )}

            {hasPendingSync && isOnline && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  توجد تعديلات محلية مسجلة أثناء الأوفلاين جاهزة للمزامنة مع جوجل درايف الآن.
                </span>
              </div>
            )}
          </div>

          <a
            ref={bridgeAnchorRef}
            href={driveBridgeUrl}
            target="_blank"
            rel="opener"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          >
            فتح نافذة الاتصال بجوجل درايف
          </a>

          {/* Cloud Drive Connection Window Panel (for file://, offline retry, or popup-blocked) */}
          {(showBridgePanel || fileProtocol) && (!user || !driveToken) && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    نافذة الاتصال والربط بالسحابة (جوجل درايف)
                  </h3>
                  <p className="text-[11px] text-blue-900/90 dark:text-blue-200 leading-relaxed">
                    افتح نافذة جوجل درايف لاختيار حسابك ومنح الإذن، وسيتم ربط هذا الملف ومزامنته مع السحابة مباشرة.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={driveBridgeUrl}
                  target="_blank"
                  rel="opener"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  فتح نافذة الاتصال بجوجل درايف
                </a>
                {fileProtocol && (
                  <button
                    type="button"
                    onClick={() => setShowOriginEditor((v) => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-200 text-[11px] font-semibold hover:bg-blue-50 dark:hover:bg-slate-800"
                  >
                    {showOriginEditor ? 'إخفاء رابط السحابة' : 'تعديل رابط السحابة'}
                  </button>
                )}
                {!fileProtocol && isOnline && (
                  <button
                    type="button"
                    disabled={linking}
                    onClick={() => void handleDirectGisConnect()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-60"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    الربط المباشر عبر Google OAuth
                  </button>
                )}
                {!fileProtocol && isFirebaseAuthAvailable && (
                  <button
                    type="button"
                    disabled={linking}
                    onClick={() => void handleConnectGoogle(queuedStrategy || undefined)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${linking ? 'animate-spin' : ''}`} />
                    محاولة الربط المباشر الآن
                  </button>
                )}
              </div>

              {showOriginEditor && (
                <div className="pt-2 border-t border-blue-200/80 dark:border-blue-800/70 space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    رابط التطبيق السحابي النشط (للربط من الملف المحلي):
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={customCloudOrigin || defaultCloudOrigin}
                    onChange={(e) => setCustomCloudOrigin(e.target.value)}
                    placeholder={defaultCloudOrigin}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-blue-200/80 dark:border-blue-800/70 space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  في حال لم ينتقل الربط تلقائياً، الصق رمز الربط السريع من النافذة هنا:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bridgeCodeInput}
                    onChange={(e) => setBridgeCodeInput(e.target.value)}
                    placeholder="الصق رمز الربط السريع..."
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={!bridgeCodeInput.trim() || syncing}
                    onClick={() => void handleApplyPastedBridgeCode()}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 disabled:opacity-50"
                  >
                    تفعيل ومزامنة
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {pendingConfirm && (
            <div
              role="alertdialog"
              aria-modal="true"
              className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-950 dark:text-amber-100">
                    {pendingConfirm.title}
                  </p>
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                    {pendingConfirm.detail}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => {
                    const action = pendingConfirm.kind;
                    setPendingConfirm(null);
                    if (action === 'push_local') {
                      void executeSyncInternal('push_local');
                    } else {
                      void executeCleanCloudInternal();
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold disabled:opacity-60"
                >
                  تأكيد التنفيذ على جوجل درايف
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>نسخة الأوفلاين (على الجهاز)</span>
                <HardDrive className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
                {localDisplayCount}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {summary && summary.localOnlyCount > 0
                  ? `${summary.localOnlyCount} عنصر جديد على الجهاز غير مرفوع بعد`
                  : 'محفوظ محلياً للعمل بدون إنترنت'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>نسخة السحابة (جوجل درايف)</span>
                <Cloud className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              </div>
              <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
                {loadingCloud
                  ? '...'
                  : user && isOnline && cloudWs
                    ? countWorkspaceItems(cloudWs)
                    : '—'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {!user || !driveToken
                  ? 'اختر حساب جوجل درايف لعرض وسحب ملف السحابة'
                  : loadingCloud
                    ? 'جاري قراءة الملف من جوجل درايف...'
                    : !driveFileId
                      ? 'سيتم إنشاء ملف قاعدة البيانات على جوجل درايف عند المزامنة'
                      : summary && summary.cloudOnlyCount > 0
                        ? `${summary.cloudOnlyCount} عنصر على جوجل درايف غير موجود محلياً`
                        : 'متزامن مع ملف جوجل درايف الخاص بك'}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={syncing || linking || loadingCloud}
              onClick={() => handleRunSync('merge')}
              className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 transition-colors text-right"
            >
              <div className="flex items-center gap-3">
                <RefreshCw
                  className={`w-5 h-5 shrink-0 ${syncing ? 'animate-spin' : ''}`}
                />
                <div>
                  <p className="text-sm font-bold">
                    {syncing
                      ? 'جاري تنفيذ المزامنة مع جوجل درايف...'
                      : 'طلب المزامنة والدمج الذكي (الجهاز ⇄ جوجل درايف)'}
                  </p>
                  <p className="text-[11px] text-blue-100">
                    {user && driveToken
                      ? 'يسحب ملف جوجل درايف ويدمجه مع بيانات جهازك بدون حذف أي عنصر'
                      : 'يفتح نافذة اختيار حساب جوجل ثم يربط ويدمج الملف مع جوجل درايف فوراً'}
                  </p>
                </div>
              </div>
              {summary && (
                <span className="font-mono text-xs bg-white/15 px-2.5 py-1 rounded-md shrink-0 tabular-nums">
                  {summary.mergedCount} عنصر
                </span>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={syncing || linking || loadingCloud}
                onClick={() => handleRunSync('pull_cloud')}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 text-right"
              >
                <CloudDownload className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    سحب الملف من جوجل درايف
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    جلب قاعدة البيانات من درايف واعتمادها الآن
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={syncing || linking || loadingCloud}
                onClick={() => handleRunSync('push_local')}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 text-right"
              >
                <CloudUpload className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    رفع الأوفلاين لجوجل درايف
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    اعتماد نسخة الجهاز على ملف جوجل درايف
                  </p>
                </div>
              </button>
            </div>

            {user && (
              <button
                type="button"
                disabled={syncing || loadingCloud}
                onClick={handleCleanCloud}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50 text-right disabled:opacity-60"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      تنظيف وتفريغ البيانات التجريبية وغير اللازمة في السحابة للتطوير
                    </p>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                      يزيل البيانات النموذجية والمسودات الفارغة والرسائل المقروءة مع الإبقاء على بياناتك الفعلية
                    </p>
                  </div>
                </div>
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {!localMode ? (
                <button
                  type="button"
                  onClick={async () => {
                    await onSwitchToOffline();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-950/60"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  تحويل الأونلاين إلى وضع الأوفلاين (حفظ على الجهاز)
                </button>
              ) : user ? (
                <button
                  type="button"
                  onClick={() => {
                    onSwitchToOnline();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 disabled:opacity-50"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  التشغيل في وضع الأونلاين (جوجل درايف)
                </button>
              ) : (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  يمكنك العمل أوفلاين بحرية ثم ربط جوجل درايف للمزامنة في أي وقت.
                </span>
              )}

              {user && (
                <button
                  type="button"
                  onClick={async () => {
                    await onSignOutGoogle();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  فصل حساب جوجل
                </button>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                عملت على ملف الـ HTML الأوفلاين؟ ارفع ملف النسخة (<code className="font-mono">.json</code>) لدمجه مع بياناتك:
              </div>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void handleJsonMergeUpload(f);
                }}
              />
              <button
                type="button"
                disabled={syncing}
                onClick={() => jsonInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FileJson className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                دمج ملف أوفلاين (.json)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
