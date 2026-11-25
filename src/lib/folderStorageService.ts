import type { WorkspaceState } from '../types';
import { EMPTY_WORKSPACE, normalizeWorkspaceState } from './localWorkspaceService';

// Minimal TypeScript interfaces for File System Access API
interface FsFileWritable {
  write: (data: Blob | string) => Promise<void>;
  close: () => Promise<void>;
}

interface FsFileHandle {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<FsFileWritable>;
}

interface FsDirectoryHandle {
  kind: 'directory';
  name: string;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FsDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FsFileHandle>;
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>;
  values: () => AsyncIterable<FsFileHandle | FsDirectoryHandle>;
  queryPermission?: (desc: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (desc: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
}

export type FolderConnectionStatus = 'unlinked' | 'needs_permission' | 'connected';

export interface FolderConnectionInfo {
  status: FolderConnectionStatus;
  folderName: string;
  supportsDirectPicker: boolean;
}

const REF_DB_NAME = 'munassiq_folder_ref_db';
const REF_STORE = 'handles';
const REF_KEY = 'new_folder_handle';
const DB_FILE_NAME = 'database.json';
const BACKUP_FILE_NAME = 'latest_backup.json';

let activeFolderHandle: FsDirectoryHandle | null = null;
let savedHandleCandidate: FsDirectoryHandle | null = null;
let syncQueue: Promise<void> = Promise.resolve();

export function isDirectoryPickerSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { showDirectoryPicker?: unknown };
  // On file:// protocol, Chromium throws SecurityError on showDirectoryPicker
  if (window.location.protocol === 'file:') return false;
  return typeof w.showDirectoryPicker === 'function';
}

function openRefDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(REF_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(REF_STORE)) {
        db.createObjectStore(REF_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandleToIdb(handle: FsDirectoryHandle | null): Promise<void> {
  try {
    const db = await openRefDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(REF_STORE, 'readwrite');
      if (handle) {
        tx.objectStore(REF_STORE).put(handle, REF_KEY);
      } else {
        tx.objectStore(REF_STORE).delete(REF_KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

async function loadHandleFromIdb(): Promise<FsDirectoryHandle | null> {
  try {
    const db = await openRefDb();
    return await new Promise<FsDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(REF_STORE, 'readonly');
      const req = tx.objectStore(REF_STORE).get(REF_KEY);
      req.onsuccess = () => resolve((req.result as FsDirectoryHandle) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export function getActiveFolderInfo(): FolderConnectionInfo {
  if (activeFolderHandle) {
    return {
      status: 'connected',
      folderName: activeFolderHandle.name,
      supportsDirectPicker: isDirectoryPickerSupported(),
    };
  }
  if (savedHandleCandidate) {
    return {
      status: 'needs_permission',
      folderName: savedHandleCandidate.name,
      supportsDirectPicker: isDirectoryPickerSupported(),
    };
  }
  return {
    status: 'unlinked',
    folderName: 'new folder',
    supportsDirectPicker: isDirectoryPickerSupported(),
  };
}

async function ensureSubdirectories(root: FsDirectoryHandle): Promise<void> {
  await root.getDirectoryHandle('files', { create: true });
  await root.getDirectoryHandle('images', { create: true });
  await root.getDirectoryHandle('snapshots', { create: true });
}

function sanitizeFileName(name: string): string {
  return String(name || 'item')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function isImageMimeOrId(id: string, blob: Blob, fileName?: string): boolean {
  if (blob.type && blob.type.startsWith('image/')) return true;
  if (id.startsWith('img_')) return true;
  if (fileName && /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName)) return true;
  return false;
}

export function stripHeavyBlobsFromDbJson(ws: WorkspaceState): WorkspaceState {
  const clean = normalizeWorkspaceState(ws);
  return {
    ...EMPTY_WORKSPACE,
    ...clean,
    images: clean.images.map((img) => ({
      ...img,
      thumbnailDataUrl: (img.thumbnailDataUrl || img.dataUrl || '').slice(0, 60000),
      dataUrl: undefined,
    })),
  };
}

export async function readDatabaseFromFolder(
  dir: FsDirectoryHandle | null = activeFolderHandle
): Promise<WorkspaceState | null> {
  if (!dir) return null;
  try {
    const fileHandle = await dir.getFileHandle(DB_FILE_NAME, { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const candidate =
      parsed && typeof parsed === 'object' && 'workspace' in parsed
        ? parsed.workspace
        : parsed;
    return normalizeWorkspaceState(candidate);
  } catch {
    return null;
  }
}

export function syncDatabaseToFolder(ws: WorkspaceState): Promise<void> {
  if (!activeFolderHandle) return Promise.resolve();
  const dir = activeFolderHandle;
  const payload = {
    app: 'إدارة البيئة — السكرتارية | شركة الدقهلية لصناعة وتكرير السكر',
    folderReference: dir.name,
    version: 3,
    updatedAt: new Date().toISOString(),
    workspace: stripHeavyBlobsFromDbJson(ws),
  };

  syncQueue = syncQueue
    .then(async () => {
      try {
        await ensureSubdirectories(dir);
        const fh = await dir.getFileHandle(DB_FILE_NAME, { create: true });
        const writable = await fh.createWritable();
        await writable.write(JSON.stringify(payload, null, 2));
        await writable.close();

        const snapDir = await dir.getDirectoryHandle('snapshots', { create: true });
        const sh = await snapDir.getFileHandle(BACKUP_FILE_NAME, { create: true });
        const sw = await sh.createWritable();
        await sw.write(JSON.stringify(payload));
        await sw.close();
      } catch {
        // Non-fatal if user revoked folder permission mid-session
      }
    })
    .catch(() => {});

  return syncQueue;
}

export async function writeBlobToFolder(
  id: string,
  blob: Blob,
  fileNameHint?: string
): Promise<void> {
  if (!activeFolderHandle) return;
  const dir = activeFolderHandle;
  const subName = isImageMimeOrId(id, blob, fileNameHint) ? 'images' : 'files';
  const rawName = fileNameHint || (blob instanceof File ? blob.name : id);
  const safeName = sanitizeFileName(rawName);
  const targetName = safeName.startsWith(id) ? safeName : `${id}__${safeName}`;

  try {
    const subDir = await dir.getDirectoryHandle(subName, { create: true });
    // Remove previous file with same id prefix if any
    for await (const entry of subDir.values()) {
      if (entry.kind === 'file' && (entry.name === id || entry.name.startsWith(`${id}__`))) {
        if (entry.name !== targetName) {
          await subDir.removeEntry(entry.name);
        }
      }
    }
    const fh = await subDir.getFileHandle(targetName, { create: true });
    const writable = await fh.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch {
    // ignore
  }
}

export async function readBlobFromFolder(id: string): Promise<Blob | null> {
  if (!activeFolderHandle) return null;
  for (const subName of ['files', 'images'] as const) {
    try {
      const subDir = await activeFolderHandle.getDirectoryHandle(subName, { create: false });
      for await (const entry of subDir.values()) {
        if (entry.kind === 'file' && (entry.name === id || entry.name.startsWith(`${id}__`))) {
          return await entry.getFile();
        }
      }
    } catch {
      // ignore missing subfolder
    }
  }
  return null;
}

export async function deleteBlobFromFolder(id: string): Promise<void> {
  if (!activeFolderHandle) return;
  for (const subName of ['files', 'images'] as const) {
    try {
      const subDir = await activeFolderHandle.getDirectoryHandle(subName, { create: false });
      for await (const entry of subDir.values()) {
        if (entry.kind === 'file' && (entry.name === id || entry.name.startsWith(`${id}__`))) {
          await subDir.removeEntry(entry.name);
        }
      }
    } catch {
      // ignore
    }
  }
}

export async function clearFolderContents(): Promise<void> {
  if (!activeFolderHandle) return;
  for (const subName of ['files', 'images'] as const) {
    try {
      const subDir = await activeFolderHandle.getDirectoryHandle(subName, { create: false });
      for await (const entry of subDir.values()) {
        await subDir.removeEntry(entry.name, { recursive: true });
      }
    } catch {
      // ignore
    }
  }
  await syncDatabaseToFolder(EMPTY_WORKSPACE);
}

export async function initSavedFolderHandle(): Promise<{
  info: FolderConnectionInfo;
  folderWorkspace: WorkspaceState | null;
}> {
  if (!isDirectoryPickerSupported()) {
    return { info: getActiveFolderInfo(), folderWorkspace: null };
  }
  const saved = await loadHandleFromIdb();
  if (!saved) {
    return { info: getActiveFolderInfo(), folderWorkspace: null };
  }
  try {
    const perm = saved.queryPermission
      ? await saved.queryPermission({ mode: 'readwrite' })
      : 'granted';
    if (perm === 'granted') {
      activeFolderHandle = saved;
      savedHandleCandidate = null;
      await ensureSubdirectories(saved);
      const folderWorkspace = await readDatabaseFromFolder(saved);
      return { info: getActiveFolderInfo(), folderWorkspace };
    }
    savedHandleCandidate = saved;
    return { info: getActiveFolderInfo(), folderWorkspace: null };
  } catch {
    return { info: getActiveFolderInfo(), folderWorkspace: null };
  }
}

export async function reconnectSavedFolderHandle(): Promise<{
  connected: boolean;
  info: FolderConnectionInfo;
  folderWorkspace: WorkspaceState | null;
}> {
  if (!savedHandleCandidate) {
    return { connected: false, info: getActiveFolderInfo(), folderWorkspace: null };
  }
  try {
    const perm = savedHandleCandidate.requestPermission
      ? await savedHandleCandidate.requestPermission({ mode: 'readwrite' })
      : 'granted';
    if (perm === 'granted') {
      activeFolderHandle = savedHandleCandidate;
      savedHandleCandidate = null;
      await ensureSubdirectories(activeFolderHandle);
      const folderWorkspace = await readDatabaseFromFolder(activeFolderHandle);
      return { connected: true, info: getActiveFolderInfo(), folderWorkspace };
    }
  } catch {
    // ignore
  }
  return { connected: false, info: getActiveFolderInfo(), folderWorkspace: null };
}

export async function connectOrCreateNewFolder(
  currentWorkspace: WorkspaceState,
  allLocalBlobs: Array<{ key: string; blob: Blob; fileName?: string }>
): Promise<{
  cancelled: boolean;
  info: FolderConnectionInfo;
  loadedFromFolder: WorkspaceState | null;
}> {
  if (!isDirectoryPickerSupported()) {
    return { cancelled: true, info: getActiveFolderInfo(), loadedFromFolder: null };
  }
  const showDirectoryPicker = (
    window as unknown as {
      showDirectoryPicker: (opts?: Record<string, unknown>) => Promise<FsDirectoryHandle>;
    }
  ).showDirectoryPicker;

  try {
    const picked = await showDirectoryPicker({
      id: 'env_new_folder',
      mode: 'readwrite',
      startIn: 'documents',
    });

    const isAlreadyNewFolder =
      picked.name.trim().toLowerCase() === 'new folder' ||
      picked.name.trim().toLowerCase() === 'new_folder';

    const targetDir = isAlreadyNewFolder
      ? picked
      : await picked.getDirectoryHandle('new folder', { create: true });

    await ensureSubdirectories(targetDir);
    activeFolderHandle = targetDir;
    savedHandleCandidate = null;
    await saveHandleToIdb(targetDir);

    const existingDb = await readDatabaseFromFolder(targetDir);
    const hasExistingData =
      existingDb &&
      existingDb.projects.length +
        existingDb.files.length +
        existingDb.images.length +
        existingDb.memos.length +
        existingDb.drafts.length +
        existingDb.orders.length +
        existingDb.correspondences.length >
        0;

    if (hasExistingData && existingDb) {
      // Also write any local blobs we have that aren't in folder yet
      for (const item of allLocalBlobs) {
        await writeBlobToFolder(item.key, item.blob, item.fileName);
      }
      return {
        cancelled: false,
        info: getActiveFolderInfo(),
        loadedFromFolder: existingDb,
      };
    }

    // Seed new folder with current workspace & blobs
    await syncDatabaseToFolder(currentWorkspace);
    for (const item of allLocalBlobs) {
      await writeBlobToFolder(item.key, item.blob, item.fileName);
    }

    return {
      cancelled: false,
      info: getActiveFolderInfo(),
      loadedFromFolder: null,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { cancelled: true, info: getActiveFolderInfo(), loadedFromFolder: null };
    }
    throw err;
  }
}

export async function disconnectFolderHandle(): Promise<FolderConnectionInfo> {
  activeFolderHandle = null;
  savedHandleCandidate = null;
  await saveHandleToIdb(null);
  return getActiveFolderInfo();
}

export async function importFromDirectoryFileList(
  fileList: FileList,
  saveBlobFn: (key: string, blob: Blob, fileName?: string) => Promise<void>
): Promise<{ workspace: WorkspaceState | null; importedBlobs: number }> {
  const files = Array.from(fileList);
  let loadedWs: WorkspaceState | null = null;
  let importedBlobs = 0;

  // Prefer database.json, fallback to latest_backup.json
  const dbFile =
    files.find((f) => f.name.toLowerCase() === DB_FILE_NAME) ||
    files.find((f) => f.name.toLowerCase() === BACKUP_FILE_NAME);

  if (dbFile) {
    try {
      const txt = await dbFile.text();
      const parsed = JSON.parse(txt) as Record<string, unknown>;
      const candidate =
        parsed && typeof parsed === 'object' && 'workspace' in parsed
          ? parsed.workspace
          : parsed;
      loadedWs = normalizeWorkspaceState(candidate);
    } catch {
      loadedWs = null;
    }
  }

  for (const f of files) {
    const rel = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(
      /\\/g,
      '/'
    );
    if (/\/(files|images)\//i.test(rel)) {
      const baseName = rel.split('/').pop() || f.name;
      const sepIdx = baseName.indexOf('__');
      const key = sepIdx > 0 ? baseName.slice(0, sepIdx) : baseName;
      const origName = sepIdx > 0 ? baseName.slice(sepIdx + 2) : baseName;
      await saveBlobFn(key, f, origName);
      importedBlobs += 1;
    }
  }

  return { workspace: loadedWs, importedBlobs };
}

/* ============================================================================
 * Pure Browser Uncompressed ZIP Builder (Store Method 0 + CRC32)
 * Generates `new folder.zip` containing database.json, files/, images/
 * ========================================================================== */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export async function buildNewFolderZipBlob(
  ws: WorkspaceState,
  blobs: Array<{ key: string; blob: Blob; fileName?: string }>
): Promise<Blob> {
  const encoder = new TextEncoder();
  const entries: Array<{ name: string; data: Uint8Array }> = [];

  const dbPayload = {
    app: 'إدارة البيئة — السكرتارية | شركة الدقهلية لصناعة وتكرير السكر',
    folderReference: 'new folder',
    version: 3,
    updatedAt: new Date().toISOString(),
    workspace: stripHeavyBlobsFromDbJson(ws),
  };

  entries.push({
    name: 'new folder/database.json',
    data: encoder.encode(JSON.stringify(dbPayload, null, 2)),
  });

  entries.push({
    name: 'new folder/README.txt',
    data: encoder.encode(
      [
        'مجلد المرجع الأوفلاين (new folder) — منظومة إدارة البيئة',
        'شركة الدقهلية لصناعة وتكرير السكر',
        '',
        'محتويات المجلد:',
        '- database.json : قاعدة البيانات الخفيفة لكافة المراسلات والمذكرات والأوامر والفهارس.',
        '- files/ : جميع الملفات المرفوعة (Word / Excel / PDF / أبحاث).',
        '- images/ : جميع الصور الميدانية المرفوعة.',
      ].join('\r\n')
    ),
  });

  for (const item of blobs) {
    const sub = isImageMimeOrId(item.key, item.blob, item.fileName) ? 'images' : 'files';
    const rawName = item.fileName || (item.blob instanceof File ? item.blob.name : item.key);
    const safeName = sanitizeFileName(rawName);
    const fileName = safeName.startsWith(item.key) ? safeName : `${item.key}__${safeName}`;
    const ab = await item.blob.arrayBuffer();
    entries.push({
      name: `new folder/${sub}/${fileName}`,
      data: new Uint8Array(ab),
    });
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const lfh = new Uint8Array(30 + nameBytes.length);
    const lView = new DataView(lfh.buffer);
    lView.setUint32(0, 0x04034b50, true);
    lView.setUint16(4, 20, true);
    lView.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lView.setUint16(8, 0, true); // store (no compression)
    lView.setUint16(10, dosTime, true);
    lView.setUint16(12, dosDate, true);
    lView.setUint32(14, crc, true);
    lView.setUint32(18, size, true);
    lView.setUint32(22, size, true);
    lView.setUint16(26, nameBytes.length, true);
    lView.setUint16(28, 0, true);
    lfh.set(nameBytes, 30);

    localParts.push(lfh, entry.data);

    const cfh = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(cfh.buffer);
    cView.setUint32(0, 0x02014b50, true);
    cView.setUint16(4, 20, true);
    cView.setUint16(6, 20, true);
    cView.setUint16(8, 0x0800, true);
    cView.setUint16(10, 0, true);
    cView.setUint16(12, dosTime, true);
    cView.setUint16(14, dosDate, true);
    cView.setUint32(16, crc, true);
    cView.setUint32(20, size, true);
    cView.setUint32(24, size, true);
    cView.setUint16(28, nameBytes.length, true);
    cView.setUint16(30, 0, true);
    cView.setUint16(32, 0, true);
    cView.setUint16(34, 0, true);
    cView.setUint16(36, 0, true);
    cView.setUint32(38, 0, true);
    cView.setUint32(42, offset, true);
    cfh.set(nameBytes, 46);

    centralParts.push(cfh);
    offset += lfh.length + size;
  }

  let centralSize = 0;
  for (const cp of centralParts) centralSize += cp.length;

  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  eView.setUint32(0, 0x06054b50, true);
  eView.setUint16(4, 0, true);
  eView.setUint16(6, 0, true);
  eView.setUint16(8, entries.length, true);
  eView.setUint16(10, entries.length, true);
  eView.setUint32(12, centralSize, true);
  eView.setUint32(16, offset, true);
  eView.setUint16(20, 0, true);

  const blobParts: BlobPart[] = [...localParts, ...centralParts, eocd].map(
    (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
  );
  return new Blob(blobParts, { type: 'application/zip' });
}
