import {
  clearFolderContents,
  deleteBlobFromFolder,
  readBlobFromFolder,
  writeBlobToFolder,
} from './folderStorageService';

const DB_NAME = 'munassiq_blobs_v1';
const STORE_NAME = 'file_blobs';

function openBlobDb(): Promise<IDBDatabase> {
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

export async function saveLocalBlob(
  key: string,
  blob: Blob,
  fileNameHint?: string
): Promise<void> {
  const nameHint = fileNameHint || (blob instanceof File ? blob.name : undefined);
  try {
    const db = await openBlobDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-blocking fallback
  }
  await writeBlobToFolder(key, blob, nameHint);
}

export async function getLocalBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openBlobDb();
    const fromIdb = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
    if (fromIdb) return fromIdb;
  } catch {
    // fallback to folder reference
  }
  const fromFolder = await readBlobFromFolder(key);
  if (fromFolder) {
    // Cache locally in IndexedDB for faster subsequent access
    try {
      const db = await openBlobDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(fromFolder, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }
  return fromFolder;
}

export async function listAllLocalBlobs(): Promise<
  Array<{ key: string; blob: Blob; fileName?: string }>
> {
  try {
    const db = await openBlobDb();
    return await new Promise<Array<{ key: string; blob: Blob; fileName?: string }>>(
      (resolve) => {
        const out: Array<{ key: string; blob: Blob; fileName?: string }> = [];
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as Blob;
            if (val instanceof Blob) {
              out.push({
                key: String(cursor.key),
                blob: val,
                fileName: val instanceof File ? val.name : undefined,
              });
            }
            cursor.continue();
          } else {
            resolve(out);
          }
        };
        req.onerror = () => resolve(out);
      }
    );
  } catch {
    return [];
  }
}

export async function deleteLocalBlob(key: string): Promise<void> {
  try {
    const db = await openBlobDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
  await deleteBlobFromFolder(key);
}

export async function clearAllLocalBlobs(): Promise<void> {
  try {
    const db = await openBlobDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
  await clearFolderContents();
}
