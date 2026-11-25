import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  Building2,
  Cloud,
  FileText,
  HardDrive,
  Moon,
  RefreshCw,
  Sun,
  Wifi,
  Zap,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import {
  DriveBridgeView,
  type DriveBridgePayload,
} from './components/DriveBridgeView';
import { ClearWorkspaceModal } from './components/ClearWorkspaceModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InspectorDrawer } from './components/InspectorDrawer';
import { LiveSearchPanel } from './components/LiveSearchPanel';
import {
  MemoA4PrintSheet,
  MemoPrintPreviewModal,
  type PrintableMemoData,
} from './components/MemoA4PrintSheet';
import { NewFolderBanner } from './components/NewFolderBanner';
import { OfflineDownloadModal } from './components/OfflineDownloadModal';
import { QuickCommandsView } from './components/QuickCommandsView';
import { Sidebar } from './components/Sidebar';
import { SyncModal, type SyncStrategy } from './components/SyncModal';
import { TopBar, type QuickAddAction } from './components/TopBar';
import { WorkspaceModals, type ModalType } from './components/WorkspaceModals';
import { DraftsView } from './components/views/DraftsView';
import { ExternalCorrespondenceView } from './components/views/ExternalCorrespondenceView';
import { FilesView } from './components/views/FilesView';
import { FoldersView } from './components/views/FoldersView';
import { ImagesView } from './components/views/ImagesView';
import { MemosView } from './components/views/MemosView';
import { OrdersView } from './components/views/OrdersView';
import { OverviewView } from './components/views/OverviewView';
import { ResearchView } from './components/views/ResearchView';
import { SubDepartmentsView } from './components/views/SubDepartmentsView';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  clearAllLocalBlobs,
  deleteLocalBlob,
  listAllLocalBlobs,
  saveLocalBlob,
} from './lib/blobStore';
import { makeSafeId } from './lib/fileParser';
import {
  auth,
  formatFirebaseAuthErrorAr,
  getDriveAccessToken,
  googleProvider,
  hasFirestoreConfigured,
  isFirebaseAuthAvailable,
  setDriveAccessToken,
  testConnection,
} from './lib/firebase';
import {
  readWorkspaceFromDrive,
  saveWorkspaceToDrive,
} from './lib/googleDriveService';
import {
  buildNewFolderZipBlob,
  connectOrCreateNewFolder,
  getActiveFolderInfo,
  importFromDirectoryFileList,
  initSavedFolderHandle,
  reconnectSavedFolderHandle,
  type FolderConnectionInfo,
} from './lib/folderStorageService';
import {
  clearLocalWorkspaceState,
  countWorkspaceItems,
  downloadDatabaseJsonFile,
  EMPTY_WORKSPACE,
  getLastSyncTimestamp,
  getLinkedGoogleHint,
  getPendingOfflineSync,
  loadLocalWorkspace,
  normalizeWorkspaceState,
  saveAutoRecoverySnapshot,
  saveLocalWorkspace,
  setLastSyncTimestamp,
  setLinkedGoogleHint,
  setPendingOfflineSync,
} from './lib/localWorkspaceService';
import {
  isStandaloneOfflineMode,
  readEmbeddedOfflineSeed,
} from './lib/offlineRuntime';
import { createSampleWorkspaceSeed } from './lib/sampleSeed';
import { searchAcrossWorkspace } from './lib/searchEngine';
import { filterOutSampleAndClutter, mergeWorkspaces } from './lib/syncEngine';
import {
  clearDiffRemovedCloudBatch,
  clearWorkspaceBatch,
  ensureUserProfile,
  fetchCloudWorkspaceOnce,
  flushPendingFirestoreWrites,
  removeCorrespondenceEntity,
  removeDraft,
  removeExternalCorrespondence,
  removeIndexedFile,
  removeIndexedImage,
  removeMemo,
  removeMessage,
  removeProject,
  removeWorkOrder,
  saveCorrespondenceEntity,
  saveDraft,
  saveExternalCorrespondence,
  saveIndexedFile,
  saveIndexedImage,
  saveMemo,
  saveProject,
  saveWorkOrder,
  seedWorkspaceBatch,
  subscribeWorkspace,
  syncMergedToCloud,
  updateDraft,
  updateExternalCorrespondence,
  updateIndexedFileMeta,
  updateIndexedImageMeta,
  updateMemo,
  updateProject,
  updateWorkOrder,
} from './lib/workspaceService';
import {
  SUB_DEPARTMENTS,
  type CorrespondenceEntity,
  type DraftScope,
  type ExternalCorrespondence,
  type IndexedFile,
  type IndexedImage,
  type InspectedItem,
  type MemoDirection,
  type NavSection,
  type ProjectFolder,
  type SubDepartmentId,
  type WorkDraft,
  type WorkMemo,
  type WorkOrder,
  type WorkspaceState,
} from './types';

function WorkspaceApp() {
  const isOnline = useOnlineStatus();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [enteredWorkspace, setEnteredWorkspace] = useState(false);
  const [appMode, setAppMode] = useState<'portal' | 'secretariat' | 'quick_requests'>('portal');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [section, setSection] = useState<NavSection>('overview');
  const [externalDir, setExternalDir] = useState<'all' | MemoDirection>('all');
  const [memoDir, setMemoDir] = useState<MemoDirection>('outgoing');
  const [draftScopeFilter, setDraftScopeFilter] = useState<'all' | DraftScope>('all');
  const [selectedSubDept, setSelectedSubDept] = useState<SubDepartmentId>('industrial_drainage');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [inspected, setInspected] = useState<InspectedItem | null>(null);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingProject, setEditingProject] = useState<ProjectFolder | null>(null);
  const [replyToMemo, setReplyToMemo] = useState<WorkMemo | null>(null);
  const [replyToCorr, setReplyToCorr] = useState<ExternalCorrespondence | null>(null);
  const [modalDefaultEntityId, setModalDefaultEntityId] = useState<string>('');
  const [modalDefaultSubDept, setModalDefaultSubDept] = useState<string>(SUB_DEPARTMENTS[0].name);

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [hasPendingSync, setHasPendingSync] = useState<boolean>(() => getPendingOfflineSync());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => getLastSyncTimestamp());
  const [linkedHint, setLinkedHint] = useState<{ email: string; displayName: string } | null>(() =>
    getLinkedGoogleHint()
  );

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('env_dark_mode') === '1';
    } catch {
      return false;
    }
  });
  const [printMemo, setPrintMemo] = useState<PrintableMemoData | null>(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printSandboxFallback, setPrintSandboxFallback] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [folderInfo, setFolderInfo] = useState<FolderConnectionInfo>(() =>
    getActiveFolderInfo()
  );
  const standaloneOffline = isStandaloneOfflineMode();
  const driveFileIdRef = useRef<string | null>(null);
  const driveSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bridgeAuthActiveRef = useRef<boolean>(false);
  const workspaceRef = useRef<WorkspaceState>(EMPTY_WORKSPACE);
  const syncModalOpenRef = useRef<boolean>(false);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    syncModalOpenRef.current = syncModalOpen;
  }, [syncModalOpen]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('env_dark_mode', darkMode ? '1' : '0');
    } catch {
      // ignore
    }
  }, [darkMode]);

  // Listen to Firebase Auth state (or boot directly in standalone offline HTML mode) & restore folder ref
  useEffect(() => {
    let mounted = true;

    const bootStandaloneOffline = async () => {
      const { info, folderWorkspace } = await initSavedFolderHandle();
      if (!mounted) return;
      setFolderInfo(info);

      let initial = folderWorkspace;
      if (!initial || countWorkspaceItems(initial) === 0) {
        const localSaved = await loadLocalWorkspace();
        if (countWorkspaceItems(localSaved) > 0) {
          initial = localSaved;
        }
      }
      if (!initial || countWorkspaceItems(initial) === 0) {
        const embedded = readEmbeddedOfflineSeed();
        if (embedded) {
          initial = embedded;
        }
      }
      const resolved = initial ? normalizeWorkspaceState(initial) : EMPTY_WORKSPACE;
      if (!mounted) return;
      setWorkspace(resolved);
      await saveLocalWorkspace(resolved);
      setLocalMode(true);
      setEnteredWorkspace(true);
      setAuthReady(true);
    };

    if (standaloneOffline) {
      void bootStandaloneOffline();
      if (!isFirebaseAuthAvailable || !auth) {
        return () => {
          mounted = false;
        };
      }
      const unsubStandalone = onAuthStateChanged(auth, (u) => {
        if (!mounted || !u) return;
        setUser(u);
        setLinkedGoogleHint({
          email: u.email || '',
          displayName: u.displayName || 'د. أيمن عبد الحميد',
        });
        setLinkedHint({
          email: u.email || '',
          displayName: u.displayName || 'د. أيمن عبد الحميد',
        });
      });
      return () => {
        mounted = false;
        unsubStandalone();
      };
    }

    if (!isFirebaseAuthAvailable || !auth) {
      void bootStandaloneOffline();
      return () => {
        mounted = false;
      };
    }

    void initSavedFolderHandle().then(({ info }) => {
      if (mounted) setFolderInfo(info);
    });

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!mounted) return;
      if (u) {
        bridgeAuthActiveRef.current = false;
        setUser(u);
        setLinkedGoogleHint({
          email: u.email || '',
          displayName: u.displayName || 'د. أيمن عبد الحميد',
        });
        setLinkedHint({
          email: u.email || '',
          displayName: u.displayName || 'د. أيمن عبد الحميد',
        });
        const savedLocal = await loadLocalWorkspace();
        if (mounted && countWorkspaceItems(savedLocal) > 0) {
          setWorkspace(savedLocal);
        }
        setEnteredWorkspace(true);
      } else {
        if (!bridgeAuthActiveRef.current) {
          setUser(null);
          setDriveAccessToken(null);
          driveFileIdRef.current = null;
        }
        // Check if local workspace already exists from prior offline session
        const savedLocal = await loadLocalWorkspace();
        if (mounted && countWorkspaceItems(savedLocal) > 0) {
          setWorkspace(savedLocal);
          setLocalMode(true);
          setEnteredWorkspace(true);
        }
      }
      if (mounted) setAuthReady(true);
    });

    void testConnection();
    return () => {
      mounted = false;
      unsub();
    };
  }, [standaloneOffline]);

  // Subscribe to Firestore when online & authenticated (only if Firestore is configured)
  useEffect(() => {
    if (!user || localMode || !hasFirestoreConfigured) return;
    let active = true;
    void ensureUserProfile(user);

    const unsub = subscribeWorkspace(
      user.uid,
      (partial) => {
        if (!active) return;
        setWorkspace((prev) => {
          const next = normalizeWorkspaceState({ ...prev, ...partial });
          void saveLocalWorkspace(next);
          return next;
        });
      },
      async () => {
        if (!active) return;
        const nowIso = new Date().toISOString();
        setLastSyncTimestamp(nowIso);
        setLastSyncedAt(nowIso);
      },
      () => {
        if (!active) return;
        showToast('تعذر المزامنة اللحظية — البيانات متاحة من الحفظ المحلي');
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, [user, localMode, showToast]);

  // Auto backup every 15 minutes & monthly overwrite backup
  useEffect(() => {
    const backupInterval = setInterval(() => {
      const now = new Date();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthlyKey = `Monthly Backup - ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      localStorage.setItem(monthlyKey, JSON.stringify(workspace));
      localStorage.setItem('Auto_Backup_Latest_15m', JSON.stringify({ timestamp: now.toISOString(), workspace }));
    }, 15 * 60 * 1000);
    return () => clearInterval(backupInterval);
  }, [workspace]);

  const scheduleDriveSync = useCallback(
    (stateToSync: WorkspaceState) => {
      const token = getDriveAccessToken();
      if (!token || !user || localMode || !isOnline) return;
      if (driveSaveTimerRef.current) clearTimeout(driveSaveTimerRef.current);
      driveSaveTimerRef.current = setTimeout(() => {
        const activeToken = getDriveAccessToken();
        if (!activeToken) return;
        void saveWorkspaceToDrive(
          activeToken,
          stateToSync,
          driveFileIdRef.current
        )
          .then((meta) => {
            driveFileIdRef.current = meta.id;
            const nowIso = new Date().toISOString();
            setLastSyncTimestamp(nowIso);
            setLastSyncedAt(nowIso);
            setPendingOfflineSync(false);
            setHasPendingSync(false);
          })
          .catch(() => {
            setPendingOfflineSync(true);
            setHasPendingSync(true);
          });
      }, 1200);
    },
    [user, localMode, isOnline]
  );

  const persistLocalMutation = useCallback(
    async (updater: (prev: WorkspaceState) => WorkspaceState, markPending = true) => {
      const updatedState = normalizeWorkspaceState(updater(workspaceRef.current));
      workspaceRef.current = updatedState;
      setWorkspace(updatedState);
      await saveLocalWorkspace(updatedState);
      await saveAutoRecoverySnapshot(updatedState, 'تحديث محلي');
      const token = getDriveAccessToken();
      if (!markPending && token && isOnline && !localMode) {
        scheduleDriveSync(updatedState);
      } else if (markPending || (!hasFirestoreConfigured && !token)) {
        setPendingOfflineSync(true);
        setHasPendingSync(true);
      }
    },
    [isOnline, localMode, scheduleDriveSync]
  );

  // Automatic cloud pull & merge helper upon linking Google Drive / Cloud
  const pullAndMergeCloudOnLink = useCallback(
    async (linkedUser: User, accessToken?: string | null): Promise<void> => {
      await ensureUserProfile(linkedUser);
      const token = accessToken ?? getDriveAccessToken();
      const [driveRes, firestoreWs, localWs] = await Promise.all([
        token
          ? readWorkspaceFromDrive(token).catch(() => null)
          : Promise.resolve(null),
        hasFirestoreConfigured
          ? fetchCloudWorkspaceOnce(linkedUser.uid)
          : Promise.resolve(EMPTY_WORKSPACE),
        loadLocalWorkspace(),
      ]);

      if (driveRes?.fileId) {
        driveFileIdRef.current = driveRes.fileId;
      }

      const cloudWs =
        driveRes && countWorkspaceItems(driveRes.workspace) > 0
          ? driveRes.workspace
          : firestoreWs;

      const cloudCount = countWorkspaceItems(cloudWs);
      const localCount = countWorkspaceItems(localWs);

      if (cloudCount > 0 && localCount === 0) {
        setWorkspace(cloudWs);
        await saveLocalWorkspace(cloudWs);
        await saveAutoRecoverySnapshot(cloudWs, 'سحب قاعدة البيانات من جوجل درايف');
        if (token && (!driveRes || !driveRes.fileId)) {
          const savedMeta = await saveWorkspaceToDrive(token, cloudWs);
          driveFileIdRef.current = savedMeta.id;
        }
        setPendingOfflineSync(false);
        setHasPendingSync(false);
        showToast(
          `تم الربط بجوجل درايف وسحب قاعدة البيانات (${cloudCount} عنصر) بنجاح`
        );
      } else if (cloudCount > 0 && localCount > 0) {
        const { merged } = mergeWorkspaces(localWs, cloudWs, true);
        if (token) {
          const savedMeta = await saveWorkspaceToDrive(
            token,
            merged,
            driveFileIdRef.current
          );
          driveFileIdRef.current = savedMeta.id;
        }
        if (hasFirestoreConfigured) {
          await syncMergedToCloud(linkedUser, firestoreWs, merged);
          await flushPendingFirestoreWrites();
        }
        setWorkspace(merged);
        await saveLocalWorkspace(merged);
        await saveAutoRecoverySnapshot(merged, 'دمج وسحب جوجل درايف عند الربط');
        setPendingOfflineSync(false);
        setHasPendingSync(false);
        showToast('تم الربط بجوجل درايف وسحب ودمج قاعدة البيانات بنجاح');
      } else if (cloudCount === 0 && localCount > 0) {
        if (token) {
          const savedMeta = await saveWorkspaceToDrive(
            token,
            localWs,
            driveFileIdRef.current
          );
          driveFileIdRef.current = savedMeta.id;
        }
        if (hasFirestoreConfigured) {
          await seedWorkspaceBatch(linkedUser, localWs);
        }
        setWorkspace(localWs);
        setPendingOfflineSync(false);
        setHasPendingSync(false);
        showToast('تم ربط جوجل درايف ورفع قاعدة بياناتك المحلية إلى السحابة بنجاح');
      } else {
        const seed = createSampleWorkspaceSeed();
        if (token) {
          const savedMeta = await saveWorkspaceToDrive(
            token,
            seed,
            driveFileIdRef.current
          );
          driveFileIdRef.current = savedMeta.id;
        }
        if (hasFirestoreConfigured) {
          await seedWorkspaceBatch(linkedUser, seed);
        }
        setWorkspace(seed);
        await saveLocalWorkspace(seed);
        setPendingOfflineSync(false);
        setHasPendingSync(false);
        showToast('تم الربط بجوجل درايف وتهيئة ملف قاعدة بيانات إدارة البيئة بنجاح');
      }

      const nowIso = new Date().toISOString();
      setLastSyncTimestamp(nowIso);
      setLastSyncedAt(nowIso);
      setLocalMode(false);
      setEnteredWorkspace(true);
    },
    [showToast]
  );

  const handleSignIn = async () => {
    if (!isFirebaseAuthAvailable || !auth || !googleProvider) {
      await handleEnterLocalMode();
      return;
    }
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
      const token = oauthCred?.accessToken || null;
      setDriveAccessToken(token);
      setLinkedGoogleHint({
        email: cred.user.email || '',
        displayName: cred.user.displayName || 'د. أيمن عبد الحميد',
      });
      setLinkedHint({
        email: cred.user.email || '',
        displayName: cred.user.displayName || 'د. أيمن عبد الحميد',
      });
      await pullAndMergeCloudOnLink(cred.user, token);
    } catch (err) {
      setAuthError(formatFirebaseAuthErrorAr(err));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleApplyBridgeAuth = useCallback(
    (payload: DriveBridgePayload): User => {
      bridgeAuthActiveRef.current = true;
      setDriveAccessToken(payload.token);
      const bridgeUser = {
        uid: payload.uid || 'drive-bridge-user',
        email: payload.email || '',
        displayName: payload.displayName || 'د. أيمن عبد الحميد',
        photoURL: null,
      } as unknown as User;
      setUser(bridgeUser);
      setLocalMode(false);
      setLinkedGoogleHint({
        email: payload.email || '',
        displayName: payload.displayName || 'د. أيمن عبد الحميد',
      });
      setLinkedHint({
        email: payload.email || '',
        displayName: payload.displayName || 'د. أيمن عبد الحميد',
      });
      return bridgeUser;
    },
    []
  );

  useEffect(() => {
    const applyIncomingBridgePayload = (data: Partial<DriveBridgePayload> | null) => {
      if (
        data &&
        data.type === 'DAKAHLIA_DRIVE_BRIDGE_AUTH' &&
        typeof data.token === 'string' &&
        data.token.trim()
      ) {
        const payload = data as DriveBridgePayload;
        const linked = handleApplyBridgeAuth(payload);
        showToast(
          `تم استلام ربط جوجل درايف لحساب ${linked.email || linked.displayName}`
        );
        if (!syncModalOpenRef.current) {
          void pullAndMergeCloudOnLink(linked, payload.token);
        }
      }
    };

    const onMessage = (event: MessageEvent) => {
      applyIncomingBridgePayload(event.data as Partial<DriveBridgePayload> | null);
    };
    window.addEventListener('message', onMessage);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('dakahlia_drive_bridge');
        bc.onmessage = (event) => {
          applyIncomingBridgePayload(event.data as Partial<DriveBridgePayload> | null);
        };
      } catch {
        bc = null;
      }
    }

    return () => {
      window.removeEventListener('message', onMessage);
      bc?.close();
    };
  }, [handleApplyBridgeAuth, pullAndMergeCloudOnLink, showToast]);

  const handleLinkGoogle = async (): Promise<User | null> => {
    if (!isFirebaseAuthAvailable || !auth || !googleProvider) {
      return null;
    }
    const cred = await signInWithPopup(auth, googleProvider);
    const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
    const token = oauthCred?.accessToken || null;
    setDriveAccessToken(token);
    setUser(cred.user);
    setLinkedGoogleHint({
      email: cred.user.email || '',
      displayName: cred.user.displayName || 'د. أيمن عبد الحميد',
    });
    setLinkedHint({
      email: cred.user.email || '',
      displayName: cred.user.displayName || 'د. أيمن عبد الحميد',
    });
    return cred.user;
  };

  const handleEnterLocalMode = async () => {
    let saved = await loadLocalWorkspace();
    if (countWorkspaceItems(saved) === 0) {
      saved = createSampleWorkspaceSeed();
      await saveLocalWorkspace(saved);
    }
    setWorkspace(saved);
    setLocalMode(true);
    setEnteredWorkspace(true);
    showToast('تم الدخول إلى وضع العمل المحلي بدون إنترنت (أوفلاين)');
  };

  const handleConnectNewFolder = async () => {
    try {
      const blobs = await listAllLocalBlobs();
      const res = await connectOrCreateNewFolder(workspace, blobs);
      setFolderInfo(res.info);
      if (res.cancelled) return;
      if (res.loadedFromFolder && countWorkspaceItems(res.loadedFromFolder) > 0) {
        const { merged } = mergeWorkspaces(workspace, res.loadedFromFolder, true);
        setWorkspace(merged);
        await saveLocalWorkspace(merged);
        showToast(`تم ربط مجلد «${res.info.folderName}» واستعادة قاعدة البيانات منه تلقائياً`);
      } else {
        showToast(`تم توليد وربط مجلد المرجع «${res.info.folderName}» وحفظ قاعدة البيانات والملفات بداخله`);
      }
    } catch {
      showToast('تعذر الوصول إلى المجلد. تأكد من منح صلاحية القراءة والكتابة.');
    }
  };

  const handleReconnectNewFolder = async () => {
    const res = await reconnectSavedFolderHandle();
    setFolderInfo(res.info);
    if (res.connected) {
      if (res.folderWorkspace && countWorkspaceItems(res.folderWorkspace) > 0) {
        const { merged } = mergeWorkspaces(workspace, res.folderWorkspace, true);
        setWorkspace(merged);
        await saveLocalWorkspace(merged);
      }
      showToast(`تمت إعادة ربط مجلد المرجع «${res.info.folderName}» بنجاح`);
    } else {
      showToast('لم يتم تأكيد صلاحية المجلد بعد');
    }
  };

  const handleDownloadNewFolderZip = async () => {
    const blobs = await listAllLocalBlobs();
    const zipBlob = await buildNewFolderZipBlob(workspace, blobs);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'new folder.zip';
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم توليد وتحميل حزمة المجلد المرجعي (new folder.zip) كاملة');
  };

  const handleDownloadDbJson = () => {
    downloadDatabaseJsonFile(workspace);
    showToast('تم حفظ قاعدة البيانات الخفيفة (database.json)');
  };

  const handleImportNewFolderFiles = async (files: FileList) => {
    const res = await importFromDirectoryFileList(files, saveLocalBlob);
    if (res.workspace) {
      const { merged } = mergeWorkspaces(workspace, res.workspace, true);
      setWorkspace(merged);
      await saveLocalWorkspace(merged);
      showToast(`تم تحميل قاعدة البيانات و(${res.importedBlobs}) ملف/صورة من مجلد المرجع`);
    } else if (res.importedBlobs > 0) {
      showToast(`تم استيراد (${res.importedBlobs}) ملف/صورة من المجلد`);
    } else {
      showToast('لم يتم العثور على database.json داخل المجلد المحدد');
    }
  };

  const handleExecuteSync = async (
    strategy: SyncStrategy,
    targetUser: User,
    localWs: WorkspaceState,
    cloudWs: WorkspaceState
  ) => {
    await ensureUserProfile(targetUser);
    const token = getDriveAccessToken();
    let finalWs: WorkspaceState;

    if (strategy === 'pull_cloud') {
      finalWs = cloudWs;
      showToast(
        `تم سحب قاعدة البيانات من جوجل درايف (${countWorkspaceItems(cloudWs)} عنصر)`
      );
    } else if (strategy === 'push_local') {
      if (token) {
        const meta = await saveWorkspaceToDrive(
          token,
          localWs,
          driveFileIdRef.current
        );
        driveFileIdRef.current = meta.id;
      }
      if (hasFirestoreConfigured) {
        await clearDiffRemovedCloudBatch(targetUser.uid, cloudWs, localWs);
        await syncMergedToCloud(targetUser, cloudWs, localWs);
      }
      finalWs = localWs;
      showToast('تم رفع بيانات الجهاز واعتمادها على جوجل درايف بنجاح');
    } else {
      const { merged } = mergeWorkspaces(localWs, cloudWs, true);
      if (token) {
        const meta = await saveWorkspaceToDrive(
          token,
          merged,
          driveFileIdRef.current
        );
        driveFileIdRef.current = meta.id;
      }
      if (hasFirestoreConfigured) {
        await syncMergedToCloud(targetUser, cloudWs, merged);
      }
      finalWs = merged;
      showToast(
        `تمت المزامنة الثنائية مع جوجل درايف ودمج ${countWorkspaceItems(merged)} عنصر بنجاح`
      );
    }

    await flushPendingFirestoreWrites();
    setWorkspace(finalWs);
    await saveLocalWorkspace(finalWs);
    await saveAutoRecoverySnapshot(finalWs, 'مزامنة سحابية');
    const nowIso = new Date().toISOString();
    setLastSyncTimestamp(nowIso);
    setLastSyncedAt(nowIso);
    setPendingOfflineSync(false);
    setHasPendingSync(false);
    setLocalMode(false);
  };

  const handleCleanCloudForDev = async (targetUser: User, cloudWs: WorkspaceState) => {
    const { cleaned, removedCount } = filterOutSampleAndClutter(cloudWs);
    const token = getDriveAccessToken();
    if (token) {
      const meta = await saveWorkspaceToDrive(
        token,
        cleaned,
        driveFileIdRef.current
      );
      driveFileIdRef.current = meta.id;
    }
    if (hasFirestoreConfigured) {
      await clearDiffRemovedCloudBatch(targetUser.uid, cloudWs, cleaned);
      await flushPendingFirestoreWrites();
    }
    setWorkspace(cleaned);
    await saveLocalWorkspace(cleaned);
    await saveAutoRecoverySnapshot(cleaned, 'تنظيف السحابة للتطوير');
    showToast(
      removedCount > 0
        ? `تم تنظيف وتفريغ ${removedCount} عنصر تجريبي/غير لازم في جوجل درايف للتطوير`
        : 'قاعدة البيانات على جوجل درايف نظيفة بالفعل وجاهزة للتطوير'
    );
  };

  const handleCleanNonEssential = async () => {
    const { cleaned, removedCount } = filterOutSampleAndClutter(workspace);
    const token = getDriveAccessToken();
    if (user && !localMode && isOnline) {
      if (token) {
        const meta = await saveWorkspaceToDrive(
          token,
          cleaned,
          driveFileIdRef.current
        );
        driveFileIdRef.current = meta.id;
      }
      if (hasFirestoreConfigured) {
        const cloudWs = await fetchCloudWorkspaceOnce(user.uid);
        await clearDiffRemovedCloudBatch(user.uid, cloudWs, cleaned);
        await flushPendingFirestoreWrites();
      }
    }
    setWorkspace(cleaned);
    await saveLocalWorkspace(cleaned);
    await saveAutoRecoverySnapshot(cleaned, 'تنظيف البيانات غير اللازمة');
    showToast(
      removedCount > 0
        ? `تم تنظيف ${removedCount} عنصر غير لازم وتجهيز قاعدة البيانات للتطوير`
        : 'قاعدة البيانات نظيفة بالفعل'
    );
  };

  const handleClearWorkspace = async () => {
    await saveAutoRecoverySnapshot(workspace, 'نسخة تلقائية قبل التفريغ');
    const token = getDriveAccessToken();
    if (user && isOnline) {
      if (token) {
        const meta = await saveWorkspaceToDrive(
          token,
          EMPTY_WORKSPACE,
          driveFileIdRef.current
        );
        driveFileIdRef.current = meta.id;
      }
      if (hasFirestoreConfigured) {
        const cloudWs = await fetchCloudWorkspaceOnce(user.uid);
        await clearWorkspaceBatch(user.uid, cloudWs);
        await flushPendingFirestoreWrites();
      }
    }
    await clearLocalWorkspaceState();
    await clearAllLocalBlobs();
    setWorkspace(EMPTY_WORKSPACE);
    setPendingOfflineSync(false);
    setHasPendingSync(false);
    setSelectedProjectId(null);
    setInspected(null);
  };

  const handleSwitchToOffline = async () => {
    await saveLocalWorkspace(workspace);
    await saveAutoRecoverySnapshot(workspace, 'تحويل من الأونلاين للأوفلاين');
    setLocalMode(true);
    showToast('تم التحويل إلى وضع الأوفلاين وحفظ نسخة كاملة على جهازك');
  };

  const handleSwitchToOnline = () => {
    if (!user || (!getDriveAccessToken() && !hasFirestoreConfigured)) {
      setSyncModalOpen(true);
      return;
    }
    setLocalMode(false);
    showToast('تم التحويل إلى وضع الأونلاين المتصل بجوجل درايف');
  };

  const handleSignOut = async () => {
    bridgeAuthActiveRef.current = false;
    setDriveAccessToken(null);
    driveFileIdRef.current = null;
    if (isFirebaseAuthAvailable && auth) {
      try {
        await signOut(auth);
      } catch {
        // ignore if offline or bridge session
      }
    }
    setUser(null);
    if (standaloneOffline) {
      setLocalMode(true);
      showToast('تم فصل حساب جوجل — العمل مستمر في الوضع المحلي');
      return;
    }
    setLocalMode(false);
    setEnteredWorkspace(false);
    showToast('تم فصل حساب جوجل وتسجيل الخروج');
  };

  const handleImportBackup = async (imported: WorkspaceState) => {
    const { merged } = mergeWorkspaces(workspace, imported, true);
    const token = getDriveAccessToken();
    if (user && !localMode && isOnline) {
      if (token) {
        const meta = await saveWorkspaceToDrive(
          token,
          merged,
          driveFileIdRef.current
        );
        driveFileIdRef.current = meta.id;
      }
      if (hasFirestoreConfigured) {
        const cloudWs = await fetchCloudWorkspaceOnce(user.uid);
        await syncMergedToCloud(user, cloudWs, merged);
        await flushPendingFirestoreWrites();
      }
    }
    setWorkspace(merged);
    await saveLocalWorkspace(merged);
    await saveAutoRecoverySnapshot(merged, 'دمج نسخة احتياطية');
  };

  // Filtered workspace slice when a Folder is selected
  const scopedWorkspace = useMemo<WorkspaceState>(() => {
    if (!selectedProjectId) return workspace;
    return {
      ...workspace,
      files: workspace.files.filter((f) => f.projectId === selectedProjectId),
      images: workspace.images.filter((i) => i.projectId === selectedProjectId),
      memos: workspace.memos.filter((m) => m.projectId === selectedProjectId),
      drafts: workspace.drafts.filter((d) => d.projectId === selectedProjectId),
      orders: workspace.orders.filter((o) => o.projectId === selectedProjectId),
    };
  }, [workspace, selectedProjectId]);

  const searchHits = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchAcrossWorkspace(searchQuery, workspace);
  }, [searchQuery, workspace]);

  const executeNativePrint = useCallback(
    (data: PrintableMemoData, fromPreviewModal = false) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const previousTitle = document.title;
      const safeTitle = (data.title || 'مذكرة عمل')
        .replace(/[\\/:*?"<>|]/g, ' ')
        .trim()
        .slice(0, 65);

      let beforePrintFired = false;
      let cleaned = false;

      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        document.body.classList.remove('printing-memo-a4');
        document.title = previousTitle;
        window.removeEventListener('beforeprint', onBeforePrint);
        window.removeEventListener('afterprint', onAfterPrint);
      };

      const onBeforePrint = () => {
        beforePrintFired = true;
      };

      const onAfterPrint = () => {
        cleanup();
      };

      window.addEventListener('beforeprint', onBeforePrint);
      window.addEventListener('afterprint', onAfterPrint);
      document.body.classList.add('printing-memo-a4');
      if (safeTitle) {
        document.title = `${safeTitle} — شركة الدقهلية لصناعة وتكرير السكر`;
      }

      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            window.print();
          } catch {
            // Ignored when print is blocked
          }
          setTimeout(() => {
            if (!beforePrintFired) {
              cleanup();
              if (fromPreviewModal) {
                showToast(
                  'نافذة المعاينة المدمجة تمنع الطباعة المباشرة؛ استخدم زر «تحميل ملف PDF» بجانبه.'
                );
              } else {
                setPrintSandboxFallback(true);
                setPrintPreviewOpen(true);
              }
            } else {
              // Safety cleanup in case afterprint doesn't fire in some browsers
              setTimeout(cleanup, 1500);
            }
          }, 260);
        }, 90);
      });
    },
    [showToast]
  );

  const handlePrintMemo = useCallback(
    (data: PrintableMemoData, options?: { previewOnly?: boolean }) => {
      setPrintMemo(data);
      if (options?.previewOnly) {
        setPrintSandboxFallback(false);
        setPrintPreviewOpen(true);
        return;
      }
      executeNativePrint(data, false);
    },
    [executeNativePrint]
  );

  // CRUD Wrappers (syncs seamlessly to Firestore when online, otherwise IndexedDB + pending flag)
  const useCloud = Boolean(user && !localMode);

  const createProjectHandler = async (p: Omit<ProjectFolder, 'createdAt'>) => {
    const full: ProjectFolder = { ...p, createdAt: new Date().toISOString() };
    await persistLocalMutation(
      (prev) => ({ ...prev, projects: [full, ...prev.projects] }),
      !useCloud
    );
    if (useCloud && user) await saveProject(user.uid, p);
  };

  const updateProjectHandler = async (
    id: string,
    updates: Partial<Pick<ProjectFolder, 'name' | 'code' | 'description' | 'domain'>>
  ) => {
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      }),
      !useCloud
    );
    if (useCloud && user) await updateProject(user.uid, id, updates);
  };

  const deleteProjectHandler = async (id: string) => {
    await persistLocalMutation(
      (prev) => ({ ...prev, projects: prev.projects.filter((p) => p.id !== id) }),
      !useCloud
    );
    if (selectedProjectId === id) setSelectedProjectId(null);
    if (useCloud && user) await removeProject(user.uid, id);
    showToast('تم حذف المجلد');
  };

  const createEntityHandler = async (ent: Omit<CorrespondenceEntity, 'createdAt'>) => {
    const full: CorrespondenceEntity = { ...ent, createdAt: new Date().toISOString() };
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        correspondenceEntities: [full, ...prev.correspondenceEntities],
      }),
      !useCloud
    );
    if (useCloud && user) await saveCorrespondenceEntity(user.uid, ent);
  };

  const deleteEntityHandler = async (id: string) => {
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        correspondenceEntities: prev.correspondenceEntities.filter((e) => e.id !== id),
      }),
      !useCloud
    );
    if (useCloud && user) await removeCorrespondenceEntity(user.uid, id);
    showToast('تم حذف جهة المراسلة');
  };

  const createCorrHandler = async (c: Omit<ExternalCorrespondence, 'updatedAt'>) => {
    const full: ExternalCorrespondence = { ...c, updatedAt: new Date().toISOString() };
    await persistLocalMutation(
      (prev) => ({ ...prev, correspondences: [full, ...prev.correspondences] }),
      !useCloud
    );
    if (useCloud && user) await saveExternalCorrespondence(user.uid, c);
  };

  const updateCorrHandler = async (
    id: string,
    updates: Partial<ExternalCorrespondence>
  ) => {
    const now = new Date().toISOString();
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        correspondences: prev.correspondences.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: now } : c
        ),
      }),
      !useCloud
    );
    if (useCloud && user) await updateExternalCorrespondence(user.uid, id, updates);
  };

  const deleteCorrHandler = async (id: string) => {
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        correspondences: prev.correspondences.filter((c) => c.id !== id),
      }),
      !useCloud
    );
    if (useCloud && user) await removeExternalCorrespondence(user.uid, id);
    showToast('تم حذف المراسلة');
  };

  const createFileHandler = async (f: Omit<IndexedFile, 'updatedAt'>) => {
    const full: IndexedFile = { ...f, updatedAt: new Date().toISOString() };
    await persistLocalMutation(
      (prev) => ({ ...prev, files: [full, ...prev.files] }),
      !useCloud
    );
    if (useCloud && user) await saveIndexedFile(user.uid, f);
  };

  const updateFileHandler = async (id: string, updates: Partial<IndexedFile>) => {
    const now = new Date().toISOString();
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        files: prev.files.map((f) =>
          f.id === id ? { ...f, ...updates, updatedAt: now } : f
        ),
      }),
      !useCloud
    );
    if (useCloud && user) await updateIndexedFileMeta(user.uid, id, updates);
  };

  const deleteFileHandler = async (id: string) => {
    await deleteLocalBlob(id);
    await persistLocalMutation(
      (prev) => ({ ...prev, files: prev.files.filter((f) => f.id !== id) }),
      !useCloud
    );
    if (useCloud && user) await removeIndexedFile(user.uid, id);
    showToast('تم حذف الملف');
  };

  const createImageHandler = async (img: IndexedImage) => {
    await persistLocalMutation(
      (prev) => ({ ...prev, images: [img, ...prev.images] }),
      !useCloud
    );
    if (useCloud && user) await saveIndexedImage(user.uid, img);
  };

  const updateImageHandler = async (id: string, updates: Partial<IndexedImage>) => {
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        images: prev.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }),
      !useCloud
    );
    if (useCloud && user) await updateIndexedImageMeta(user.uid, id, updates);
  };

  const deleteImageHandler = async (id: string) => {
    await deleteLocalBlob(id);
    await persistLocalMutation(
      (prev) => ({ ...prev, images: prev.images.filter((i) => i.id !== id) }),
      !useCloud
    );
    if (useCloud && user) await removeIndexedImage(user.uid, id);
    showToast('تم حذف الصورة');
  };

  const createMemoHandler = async (m: Omit<WorkMemo, 'updatedAt'>) => {
    const full: WorkMemo = { ...m, updatedAt: new Date().toISOString() };
    await persistLocalMutation(
      (prev) => ({ ...prev, memos: [full, ...prev.memos] }),
      !useCloud
    );
    if (useCloud && user) await saveMemo(user.uid, m);
  };

  const updateMemoHandler = async (id: string, updates: Partial<WorkMemo>) => {
    const now = new Date().toISOString();
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        memos: prev.memos.map((m) =>
          m.id === id ? { ...m, ...updates, updatedAt: now } : m
        ),
      }),
      !useCloud
    );
    if (useCloud && user) await updateMemo(user.uid, id, updates);
  };

  const deleteMemoHandler = async (id: string) => {
    await persistLocalMutation(
      (prev) => ({ ...prev, memos: prev.memos.filter((m) => m.id !== id) }),
      !useCloud
    );
    if (useCloud && user) await removeMemo(user.uid, id);
    showToast('تم حذف المذكرة');
  };

  const createDraftHandler = async (d: Omit<WorkDraft, 'updatedAt'>) => {
    const full: WorkDraft = { ...d, updatedAt: new Date().toISOString() };
    await persistLocalMutation(
      (prev) => ({ ...prev, drafts: [full, ...prev.drafts] }),
      !useCloud
    );
    if (useCloud && user) await saveDraft(user.uid, d);
  };

  const updateDraftHandler = async (id: string, updates: Partial<WorkDraft>) => {
    const now = new Date().toISOString();
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        drafts: prev.drafts.map((d) =>
          d.id === id ? { ...d, ...updates, updatedAt: now } : d
        ),
      }),
      !useCloud
    );
    if (useCloud && user) await updateDraft(user.uid, id, updates);
  };

  const deleteDraftHandler = async (id: string) => {
    await persistLocalMutation(
      (prev) => ({ ...prev, drafts: prev.drafts.filter((d) => d.id !== id) }),
      !useCloud
    );
    if (useCloud && user) await removeDraft(user.uid, id);
    showToast('تم حذف المسودة');
  };

  const createOrderHandler = async (o: Omit<WorkOrder, 'createdAt'>) => {
    const full: WorkOrder = { ...o, createdAt: new Date().toISOString() };
    await persistLocalMutation(
      (prev) => ({ ...prev, orders: [full, ...prev.orders] }),
      !useCloud
    );
    if (useCloud && user) await saveWorkOrder(user.uid, o);
  };

  const updateOrderHandler = async (id: string, updates: Partial<WorkOrder>) => {
    await persistLocalMutation(
      (prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === id ? { ...o, ...updates } : o)),
      }),
      !useCloud
    );
    if (useCloud && user) await updateWorkOrder(user.uid, id, updates);
  };

  const deleteOrderHandler = async (id: string) => {
    await persistLocalMutation(
      (prev) => ({ ...prev, orders: prev.orders.filter((o) => o.id !== id) }),
      !useCloud
    );
    if (useCloud && user) await removeWorkOrder(user.uid, id);
    showToast('تم حذف مذكرة الأعمال');
  };

  const followUpOrderHandler = async (order: WorkOrder) => {
    await createOrderHandler({
      id: makeSafeId('ord'),
      refCode: `${order.refCode}-F`,
      title: `متابعة: ${order.title}`,
      details: order.details,
      domain: order.domain,
      projectId: order.projectId,
      issuer: order.issuer,
      assigneeOrUnit: order.assigneeOrUnit,
      subDepartment: order.subDepartment,
      technicians: order.technicians || [],
      isAssigned: Boolean(order.isAssigned),
      priority: order.priority,
      status: 'new',
      dueDate: new Date().toISOString().slice(0, 10),
      linkedFileIds: order.linkedFileIds || [],
    });
    showToast('تم إنشاء مذكرة متابعة جديدة');
  };

  const deleteMessageHandler = async (id: string) => {
    await persistLocalMutation(
      (prev) => ({ ...prev, messages: prev.messages.filter((m) => m.id !== id) }),
      !useCloud
    );
    if (useCloud && user) await removeMessage(user.uid, id);
    showToast('تم حذف الرسالة');
  };

  const openQuickAdd = (kind: QuickAddAction) => {
    setEditingProject(null);
    setReplyToMemo(null);
    setReplyToCorr(null);
    setActiveModal(kind);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            جاري تحميل منظومة إدارة البيئة — السكرتارية...
          </p>
        </div>
      </div>
    );
  }

  if (!enteredWorkspace && !user && !localMode) {
    return (
      <AuthGate
        onSignIn={handleSignIn}
        onEnterLocalMode={handleEnterLocalMode}
        isSigningIn={isSigningIn}
        authError={authError}
      />
    );
  }

  const selectedProjectObj =
    workspace.projects.find((p) => p.id === selectedProjectId) || null;

  const counts = {
    correspondences: workspace.correspondences.length,
    correspondencesIn: workspace.correspondences.filter((c) => c.direction === 'incoming').length,
    correspondencesOut: workspace.correspondences.filter((c) => c.direction === 'outgoing').length,
    memosIn: workspace.memos.filter((m) => m.direction === 'incoming').length,
    memosOut: workspace.memos.filter((m) => (m.direction || 'outgoing') === 'outgoing').length,
    drafts: workspace.drafts.length,
    draftsFactory: workspace.drafts.filter((d) => (d.scope || 'factory') === 'factory').length,
    draftsPrivate: workspace.drafts.filter((d) => d.scope === 'private').length,
    ordersOpen: workspace.orders.filter((o) => o.status !== 'done').length,
    research: workspace.files.filter(
      (f) => (f.researchKind && f.researchKind !== 'none') || f.domain === 'university'
    ).length,
    files: workspace.files.length,
    images: workspace.images.length,
    folders: workspace.projects.length,
  };



  const sharedGlobalOverlays = (
    <>
      <SyncModal
        open={syncModalOpen}
        user={user}
        localMode={localMode}
        isOnline={isOnline}
        hasPendingSync={hasPendingSync}
        lastSyncedAt={lastSyncedAt}
        linkedHint={linkedHint}
        workspace={workspace}
        onClose={() => setSyncModalOpen(false)}
        onLinkGoogle={handleLinkGoogle}
        onApplyBridgeAuth={handleApplyBridgeAuth}
        onExecuteSync={handleExecuteSync}
        onCleanCloudForDev={handleCleanCloudForDev}
        onSwitchToOffline={handleSwitchToOffline}
        onSwitchToOnline={handleSwitchToOnline}
        onMergeImportedJson={handleImportBackup}
        onSignOutGoogle={handleSignOut}
        onToast={showToast}
      />

      <MemoA4PrintSheet memo={printMemo} />

      <MemoPrintPreviewModal
        memo={printMemo}
        open={printPreviewOpen}
        sandboxNotice={printSandboxFallback}
        onClose={() => setPrintPreviewOpen(false)}
        onTriggerNativePrint={() => {
          if (printMemo) executeNativePrint(printMemo, true);
        }}
        onToast={showToast}
      />

      {toastMsg && (
        <div
          role="status"
          className="no-print fixed bottom-5 left-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-bold shadow-xl border border-slate-700 dark:border-slate-200"
        >
          {toastMsg}
        </div>
      )}
    </>
  );

  if (appMode === 'portal') {
    return (
      <>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
          {/* Unified Header matching Secretariat TopBar */}
          <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 py-3">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                    شركة الدقهلية لصناعة وتكرير السكر
                  </div>
                  <h1 className="font-display text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                    الإدارة العامة للبيئة والسلامة المهنية
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSyncModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  title="حالة المزامنة وجوجل درايف"
                >
                  {user && !localMode && isOnline ? (
                    <Cloud className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span className="hidden sm:inline">
                    {user && !localMode
                      ? 'الحالة متصل'
                      : standaloneOffline && isOnline
                        ? 'ربط السحابة'
                        : 'غير متصل'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDarkMode((v) => !v)}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  aria-label="تبديل المظهر"
                  title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-5xl w-full mx-auto px-4 lg:px-6 py-10 sm:py-14 flex flex-col justify-center">
            <div className="text-center max-w-2xl mx-auto space-y-2.5 mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                الإدارة العامة للبيئة والسلامة المهنية
              </h2>
              <p className="text-sm sm:text-base font-semibold text-slate-600 dark:text-slate-300">
                مدير عام الإدارة د. كيميائي أيمن عبد الحميد
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
              {/* 1. Quick Commands */}
              <button
                type="button"
                onClick={() => setAppMode('quick_requests')}
                className="group bg-white dark:bg-slate-900 hover:border-blue-600 dark:hover:border-blue-500 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 text-right transition-all shadow-xs hover:shadow-md flex flex-col justify-start"
              >
                <div className="space-y-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                    الأوامر السريعة
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    اتصال بفريق العمل، والاتصال بالذكاء الاصطناعي، والملاحظات الإدارية، والتكليف بعمل، والتقارير اليومية، والمسودات والأفكار.
                  </p>
                </div>
              </button>

              {/* 2. Secretariat Management */}
              <button
                type="button"
                onClick={() => setAppMode('secretariat')}
                className="group bg-white dark:bg-slate-900 hover:border-emerald-600 dark:hover:border-emerald-500 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 text-right transition-all shadow-xs hover:shadow-md flex flex-col justify-start"
              >
                <div className="space-y-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    السكرتارية (إدارة البيئة)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    منظومة السكرتارية الشاملة: المراسلات الصادرة والواردة، مذكرات الأعمال، المجلدات، الأبحاث، والتكليفات اليومية.
                  </p>
                </div>
              </button>
            </div>
          </main>

          <footer className="text-center py-5 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800 space-y-1">
            <p className="font-display text-xs font-bold text-slate-900 dark:text-white">إنتاج وتطوير أحمد جلال</p>
            <p className="text-[11px] text-slate-500"><span className="font-mono">2026</span> · الإصدار الرابع</p>
          </footer>
        </div>
        {sharedGlobalOverlays}
      </>
    );
  }

  if (appMode === 'quick_requests') {
    return (
      <>
        <QuickCommandsView
          workspace={workspace}
          user={user}
          localMode={localMode}
          isOnline={isOnline}
          darkMode={darkMode}
          selectedProjectId={selectedProjectId || ''}
          onToggleDark={() => setDarkMode((v) => !v)}
          onReturnToPortal={() => setAppMode('portal')}
          onOpenSecretariat={() => setAppMode('secretariat')}
          onOpenSyncModal={() => setSyncModalOpen(true)}
          onCreateDraft={createDraftHandler}
          onUpdateDraft={updateDraftHandler}
          onDeleteDraft={deleteDraftHandler}
          onCreateOrder={createOrderHandler}
          onUpdateOrder={updateOrderHandler}
          onPrintMemo={handlePrintMemo}
          onToast={showToast}
        />
        {sharedGlobalOverlays}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      <Sidebar
        section={section}
        externalFilterDirection={externalDir}
        memoFilterDirection={memoDir}
        draftScopeFilter={draftScopeFilter}
        selectedSubDept={selectedSubDept}
        selectedProjectId={selectedProjectId}
        projects={workspace.projects}
        counts={counts}
        user={user}
        localMode={localMode}
        isOnline={isOnline}
        hasPendingSync={hasPendingSync}
        darkMode={darkMode}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectSection={setSection}
        onSelectExternalDirection={setExternalDir}
        onSelectSubDept={setSelectedSubDept}
        onSelectMemoDirection={setMemoDir}
        onSelectDraftScope={setDraftScopeFilter}
        onSelectProject={setSelectedProjectId}
        onNewFolder={() => {
          setEditingProject(null);
          setActiveModal('project');
        }}
        onOpenSyncModal={() => setSyncModalOpen(true)}
        onSwitchToOffline={handleSwitchToOffline}
        onOpenOfflineModal={() => setOfflineModalOpen(true)}
        onOpenClearModal={() => setClearModalOpen(true)}
        onToggleDark={() => setDarkMode((v) => !v)}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          section={section}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedProject={selectedProjectObj}
          onClearProject={() => setSelectedProjectId(null)}
          user={user}
          localMode={localMode}
          isOnline={isOnline}
          hasPendingSync={hasPendingSync}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickAdd={openQuickAdd}
          onOpenOfflineModal={() => setOfflineModalOpen(true)}
          onOpenSyncModal={() => setSyncModalOpen(true)}
          onReturnToPortal={() => setAppMode('portal')}
          onToast={showToast}
        />

        <main className="no-print flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          <NewFolderBanner
            folderInfo={folderInfo}
            isStandaloneOffline={standaloneOffline}
            onConnectFolder={handleConnectNewFolder}
            onReconnectFolder={handleReconnectNewFolder}
            onDownloadZipFolder={handleDownloadNewFolderZip}
            onDownloadDbJson={handleDownloadDbJson}
            onImportFolderFiles={handleImportNewFolderFiles}
          />

          {/* Online Sync Reminder Banner when offline edits exist or Drive token needs refresh */}
          {isOnline &&
            (localMode ||
              hasPendingSync ||
              (Boolean(user) && !getDriveAccessToken() && !hasFirestoreConfigured)) && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200">
                  <Wifi className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                  <span>
                    {hasPendingSync
                      ? 'لديك تعديلات محلية جاهزة للمزامنة مع جوجل درايف الآن.'
                      : user && !getDriveAccessToken() && !hasFirestoreConfigured
                        ? 'للمزامنة التلقائية مع ملف جوجل درايف، أعد اختيار حساب جوجل لهذه الجلسة.'
                        : standaloneOffline
                          ? 'الإنترنت متاح الآن — اضغط لربط ملف الأوفلاين بجوجل درايف ومزامنة السحابة.'
                          : 'أنت تعمل الآن بالوضع المحلي — يمكنك الربط والمزامنة مع جوجل درايف في أي وقت.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{standaloneOffline ? 'الاتصال بالسحابة والمزامنة' : 'طلب المزامنة الآن'}</span>
                </button>
              </div>
            )}

          {searchQuery.trim() && (
            <LiveSearchPanel
              query={searchQuery}
              hits={searchHits}
              projects={workspace.projects}
              onInspect={setInspected}
            />
          )}

          {section === 'overview' && (
            <OverviewView
              workspace={scopedWorkspace}
              onNavigate={setSection}
              onSelectSubDept={setSelectedSubDept}
              onInspect={setInspected}
            />
          )}

          {section === 'external' && (
            <ExternalCorrespondenceView
              entities={workspace.correspondenceEntities}
              correspondences={workspace.correspondences}
              filterDirection={externalDir}
              onChangeDirection={setExternalDir}
              onAddEntity={() => setActiveModal('entity')}
              onAddCorrespondence={(entId) => {
                setReplyToCorr(null);
                setModalDefaultEntityId(entId || '');
                setActiveModal('correspondence');
              }}
              onReplyCorrespondence={(corr) => {
                setReplyToCorr(corr);
                setActiveModal('correspondence');
              }}
              onDeleteEntity={deleteEntityHandler}
              onDeleteCorrespondence={deleteCorrHandler}
              onInspect={setInspected}
              onPrintMemo={handlePrintMemo}
            />
          )}

          {section === 'sub_departments' && (
            <SubDepartmentsView
              selectedSubDept={selectedSubDept}
              onSelectSubDept={setSelectedSubDept}
              orders={scopedWorkspace.orders}
              correspondences={workspace.correspondences}
              onAddOrderForDept={(deptName) => {
                setModalDefaultSubDept(deptName);
                setActiveModal('order');
              }}
              onAddCorrForDept={(deptName) => {
                setReplyToCorr(null);
                setModalDefaultSubDept(deptName);
                setActiveModal('correspondence');
              }}
              onInspect={setInspected}
              onDeleteOrder={deleteOrderHandler}
            />
          )}

          {section === 'memos' && (
            <MemosView
              memos={scopedWorkspace.memos}
              files={scopedWorkspace.files}
              direction={memoDir}
              onChangeDirection={setMemoDir}
              onAddMemo={(dir) => {
                setReplyToMemo(null);
                setMemoDir(dir);
                setActiveModal('memo');
              }}
              onReplyMemo={(memo) => {
                setReplyToMemo(memo);
                setActiveModal('memo');
              }}
              onDeleteMemo={deleteMemoHandler}
              onDeleteFile={deleteFileHandler}
              onInspect={setInspected}
              onPrintMemo={handlePrintMemo}
            />
          )}

          {section === 'drafts' && (
            <DraftsView
              drafts={scopedWorkspace.drafts}
              scopeFilter={draftScopeFilter}
              onChangeScopeFilter={setDraftScopeFilter}
              onAddDraft={(scope) => {
                setDraftScopeFilter(scope);
                setActiveModal('draft');
              }}
              onDeleteDraft={deleteDraftHandler}
              onInspect={setInspected}
              onPrintMemo={handlePrintMemo}
            />
          )}

          {section === 'folders' && (
            <FoldersView
              workspace={workspace}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onNewFolder={() => {
                setEditingProject(null);
                setActiveModal('project');
              }}
              onEditFolder={(proj) => {
                setEditingProject(proj);
                setActiveModal('project');
              }}
              onDeleteFolder={deleteProjectHandler}
            />
          )}

          {section === 'orders' && (
            <OrdersView
              orders={scopedWorkspace.orders}
              onAddOrder={() => setActiveModal('order')}
              onUpdateOrder={updateOrderHandler}
              onDeleteOrder={deleteOrderHandler}
              onFollowUpOrder={followUpOrderHandler}
              onInspect={setInspected}
            />
          )}

          {section === 'research' && (
            <ResearchView
              files={scopedWorkspace.files}
              defaultProjectId={selectedProjectId || ''}
              onAddResearchModal={() => setActiveModal('research')}
              onCreateFile={createFileHandler}
              onDeleteFile={deleteFileHandler}
              onInspect={setInspected}
              onToast={showToast}
            />
          )}

          {section === 'files' && (
            <FilesView
              files={scopedWorkspace.files}
              projects={workspace.projects}
              defaultProjectId={selectedProjectId || ''}
              onAddFileModal={() => setActiveModal('file')}
              onCreateFile={createFileHandler}
              onUpdateFile={updateFileHandler}
              onDeleteFile={deleteFileHandler}
              onInspect={setInspected}
              onToast={showToast}
            />
          )}

          {section === 'images' && (
            <ImagesView
              images={scopedWorkspace.images}
              projects={workspace.projects}
              defaultProjectId={selectedProjectId || ''}
              onAddImageModal={() => setActiveModal('image')}
              onCreateImage={createImageHandler}
              onDeleteImage={deleteImageHandler}
              onInspect={setInspected}
              onToast={showToast}
            />
          )}
        </main>
        <footer className="no-print text-center py-4 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800 mt-auto space-y-0.5">
          <p className="font-display text-xs font-bold text-slate-900 dark:text-white">إنتاج وتطوير أحمد جلال</p>
          <p className="text-[11px] text-slate-500"><span className="font-mono">2026</span> · الإصدار الرابع</p>
        </footer>
      </div>

      {/* Inspector Drawer */}
      <InspectorDrawer
        inspected={inspected}
        workspace={workspace}
        onClose={() => setInspected(null)}
        onInspect={setInspected}
        onUpdateFile={updateFileHandler}
        onDeleteFile={deleteFileHandler}
        onUpdateImage={updateImageHandler}
        onDeleteImage={deleteImageHandler}
        onUpdateMemo={updateMemoHandler}
        onDeleteMemo={deleteMemoHandler}
        onReplyMemo={(memo) => {
          setInspected(null);
          setReplyToMemo(memo);
          setActiveModal('memo');
        }}
        onUpdateDraft={updateDraftHandler}
        onDeleteDraft={deleteDraftHandler}
        onUpdateOrder={updateOrderHandler}
        onDeleteOrder={deleteOrderHandler}
        onFollowUpOrder={followUpOrderHandler}
        onUpdateCorrespondence={updateCorrHandler}
        onDeleteCorrespondence={deleteCorrHandler}
        onReplyCorrespondence={(corr) => {
          setInspected(null);
          setReplyToCorr(corr);
          setActiveModal('correspondence');
        }}
        onDeleteMessage={deleteMessageHandler}
        onPrintMemo={handlePrintMemo}
        onToast={showToast}
      />

      {/* Modals */}
      <WorkspaceModals
        modal={activeModal}
        projects={workspace.projects}
        entities={workspace.correspondenceEntities}
        defaultProjectId={selectedProjectId || ''}
        defaultMemoDirection={memoDir}
        defaultDraftScope={draftScopeFilter === 'private' ? 'private' : 'factory'}
        defaultSubDepartment={modalDefaultSubDept}
        defaultEntityId={modalDefaultEntityId}
        editingProject={editingProject}
        replyToMemo={replyToMemo}
        replyToCorrespondence={replyToCorr}
        onClose={() => {
          setActiveModal(null);
          setEditingProject(null);
          setReplyToMemo(null);
          setReplyToCorr(null);
        }}
        onCreateEntity={createEntityHandler}
        onCreateCorrespondence={createCorrHandler}
        onCreateProject={createProjectHandler}
        onUpdateProject={updateProjectHandler}
        onCreateFile={createFileHandler}
        onCreateImage={createImageHandler}
        onCreateMemo={createMemoHandler}
        onCreateDraft={createDraftHandler}
        onCreateOrder={createOrderHandler}
        onPrintMemo={handlePrintMemo}
        onToast={showToast}
      />

      <OfflineDownloadModal
        open={offlineModalOpen}
        workspace={workspace}
        folderInfo={folderInfo}
        onConnectNewFolder={handleConnectNewFolder}
        onReconnectNewFolder={handleReconnectNewFolder}
        onDownloadNewFolderZip={handleDownloadNewFolderZip}
        onDownloadDbJson={handleDownloadDbJson}
        onImportNewFolderFiles={handleImportNewFolderFiles}
        onClose={() => setOfflineModalOpen(false)}
        onImportBackup={handleImportBackup}
        onOpenClearModal={() => setClearModalOpen(true)}
        onToast={showToast}
      />

      <ClearWorkspaceModal
        open={clearModalOpen}
        workspace={workspace}
        onClose={() => setClearModalOpen(false)}
        onConfirmClear={handleClearWorkspace}
        onCleanNonEssential={handleCleanNonEssential}
        onToast={showToast}
      />

      {sharedGlobalOverlays}
    </div>
  );
}

export function App() {
  const isDriveBridge =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('drive_bridge') === '1';

  return (
    <ErrorBoundary>
      {isDriveBridge ? <DriveBridgeView /> : <WorkspaceApp />}
    </ErrorBoundary>
  );
}

export default App;
