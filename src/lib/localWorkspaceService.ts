import type {
  CorrespondenceEntity,
  ExternalCorrespondence,
  IncomingMessage,
  IndexedFile,
  IndexedImage,
  ProjectFolder,
  WorkDraft,
  WorkMemo,
  WorkOrder,
  WorkspaceState,
} from '../types';

import {
  stripHeavyBlobsFromDbJson,
  syncDatabaseToFolder,
} from './folderStorageService';

export const EMPTY_WORKSPACE: WorkspaceState = {
  projects: [],
  files: [],
  images: [],
  memos: [],
  drafts: [],
  orders: [],
  messages: [],
  correspondenceEntities: [],
  correspondences: [],
};

const DB_NAME = 'munassiq_workspace_db';
const STORE_NAME = 'workspace_state';
const STATE_KEY = 'current_workspace';
const RECOVERY_KEY = 'auto_recovery_snapshot';

const PENDING_SYNC_KEY = 'munassiq_pending_offline_sync';
const LAST_SYNC_KEY = 'munassiq_last_sync_at';
const LINKED_GOOGLE_HINT_KEY = 'munassiq_linked_google_hint';

export interface AutoRecoverySnapshot {
  savedAt: string;
  label: string;
  workspace: WorkspaceState;
}

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function countWorkspaceItems(ws: WorkspaceState): number {
  return (
    ws.projects.length +
    ws.files.length +
    ws.images.length +
    ws.memos.length +
    ws.drafts.length +
    ws.orders.length +
    ws.messages.length +
    ws.correspondenceEntities.length +
    ws.correspondences.length
  );
}

export function normalizeWorkspaceState(raw: unknown): WorkspaceState {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkspaceState>;
  const asArr = <T>(val: unknown): T[] => (Array.isArray(val) ? (val as T[]) : []);
  return {
    projects: asArr<ProjectFolder>(obj.projects),
    files: asArr<IndexedFile>(obj.files),
    images: asArr<IndexedImage>(obj.images),
    memos: asArr<WorkMemo>(obj.memos),
    drafts: asArr<WorkDraft>(obj.drafts),
    orders: asArr<WorkOrder>(obj.orders),
    messages: asArr<IncomingMessage>(obj.messages),
    correspondenceEntities: asArr<CorrespondenceEntity>(obj.correspondenceEntities),
    correspondences: asArr<ExternalCorrespondence>(obj.correspondences),
  };
}

export async function loadLocalWorkspace(): Promise<WorkspaceState> {
  try {
    const db = await openWorkspaceDb();
    const res = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(STATE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (res) return normalizeWorkspaceState(res);
  } catch {
    // fallback to localStorage if IndexedDB fails
  }
  try {
    const ls = localStorage.getItem('munassiq_workspace_fallback');
    if (ls) return normalizeWorkspaceState(JSON.parse(ls));
  } catch {
    // ignore
  }
  return EMPTY_WORKSPACE;
}

export async function saveLocalWorkspace(ws: WorkspaceState): Promise<void> {
  const clean = normalizeWorkspaceState(ws);
  try {
    const db = await openWorkspaceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(clean, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(
        'munassiq_workspace_fallback',
        JSON.stringify(stripHeavyBlobsFromDbJson(clean))
      );
    } catch {
      // ignore quota error
    }
  }
  void syncDatabaseToFolder(clean);
}

export function downloadDatabaseJsonFile(ws: WorkspaceState): void {
  const payload = {
    app: 'إدارة البيئة — السكرتارية | شركة الدقهلية لصناعة وتكرير السكر',
    folderReference: 'new folder',
    version: 3,
    updatedAt: new Date().toISOString(),
    workspace: stripHeavyBlobsFromDbJson(ws),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'database.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function clearLocalWorkspaceState(): Promise<void> {
  try {
    const db = await openWorkspaceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem('munassiq_workspace_fallback');
  } catch {
    // ignore
  }
}

export async function saveAutoRecoverySnapshot(
  ws: WorkspaceState,
  label: string
): Promise<void> {
  try {
    const db = await openWorkspaceDb();
    const snap: AutoRecoverySnapshot = {
      savedAt: new Date().toISOString(),
      label,
      workspace: normalizeWorkspaceState(ws),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snap, RECOVERY_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function loadAutoRecoverySnapshot(): Promise<AutoRecoverySnapshot | null> {
  try {
    const db = await openWorkspaceDb();
    const res = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(RECOVERY_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (res && typeof res === 'object' && 'workspace' in res) {
      const snap = res as AutoRecoverySnapshot;
      return {
        savedAt: String(snap.savedAt || ''),
        label: String(snap.label || 'نسخة استرداد تلقائية'),
        workspace: normalizeWorkspaceState(snap.workspace),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function downloadWorkspaceBackupJson(
  ws: WorkspaceState,
  filePrefix = 'نسخة_احتياطية_إدارة_البيئة'
): void {
  const payload = {
    app: 'إدارة البيئة — السكرتارية | شركة الدقهلية لصناعة وتكرير السكر',
    exportedAt: new Date().toISOString(),
    version: 2,
    workspace: normalizeWorkspaceState(ws),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseWorkspaceBackupJson(file: File): Promise<WorkspaceState> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const wsCandidate =
    parsed && typeof parsed === 'object' && 'workspace' in parsed
      ? parsed.workspace
      : parsed;
  return normalizeWorkspaceState(wsCandidate);
}

export function getPendingOfflineSync(): boolean {
  try {
    return localStorage.getItem(PENDING_SYNC_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPendingOfflineSync(pending: boolean): void {
  try {
    if (pending) {
      localStorage.setItem(PENDING_SYNC_KEY, '1');
    } else {
      localStorage.removeItem(PENDING_SYNC_KEY);
    }
  } catch {
    // ignore
  }
}

export function getLastSyncTimestamp(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncTimestamp(iso: string): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, iso);
  } catch {
    // ignore
  }
}

export function getLinkedGoogleHint(): { email: string; displayName: string } | null {
  try {
    const raw = localStorage.getItem(LINKED_GOOGLE_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; displayName?: string };
    if (!parsed.email) return null;
    return {
      email: parsed.email,
      displayName: parsed.displayName || '',
    };
  } catch {
    return null;
  }
}

export function setLinkedGoogleHint(
  hint: { email: string; displayName: string } | null
): void {
  try {
    if (!hint || !hint.email) {
      localStorage.removeItem(LINKED_GOOGLE_HINT_KEY);
    } else {
      localStorage.setItem(LINKED_GOOGLE_HINT_KEY, JSON.stringify(hint));
    }
  } catch {
    // ignore
  }
}
