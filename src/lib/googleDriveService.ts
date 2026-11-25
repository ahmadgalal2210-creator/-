import type { WorkspaceState } from '../types';
import { EMPTY_WORKSPACE, normalizeWorkspaceState } from './localWorkspaceService';
import { sanitizeWorkspaceForSync } from './syncEngine';

const DRIVE_FILE_NAME = 'dakahlia_env_workspace_database.json';
const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface DriveReadResult {
  fileId: string | null;
  modifiedTime?: string;
  workspace: WorkspaceState;
}

async function parseDriveError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { message?: string; status?: string };
    };
    if (res.status === 401 || res.status === 403) {
      return 'انتهت صلاحية إذن جوجل درايف أو لم يتم منحه. يرجى إعادة اختيار حساب جوجل درايف والموافقة على الصلاحية.';
    }
    return body?.error?.message || `خطأ من جوجل درايف (${res.status})`;
  } catch {
    return `تعذر الاتصال بجوجل درايف (HTTP ${res.status})`;
  }
}

export async function findWorkspaceDriveFile(
  accessToken: string
): Promise<DriveFileMeta | null> {
  const q = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
  const url = `${DRIVE_FILES_ENDPOINT}?q=${q}&spaces=drive&orderBy=modifiedTime desc&pageSize=1&fields=files(id,name,modifiedTime)`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(await parseDriveError(res));
  }
  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

export async function readWorkspaceFromDrive(
  accessToken: string
): Promise<DriveReadResult> {
  const existing = await findWorkspaceDriveFile(accessToken);
  if (!existing) {
    return {
      fileId: null,
      workspace: EMPTY_WORKSPACE,
    };
  }

  const res = await fetch(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(existing.id)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) {
    throw new Error(await parseDriveError(res));
  }
  const raw = await res.json();
  const ws = normalizeWorkspaceState(
    raw && typeof raw === 'object' && 'workspace' in raw
      ? (raw as { workspace: unknown }).workspace
      : raw
  );
  return {
    fileId: existing.id,
    modifiedTime: existing.modifiedTime,
    workspace: ws,
  };
}

export async function saveWorkspaceToDrive(
  accessToken: string,
  workspace: WorkspaceState,
  existingFileId?: string | null
): Promise<DriveFileMeta> {
  let targetFileId = existingFileId || null;
  if (!targetFileId) {
    const found = await findWorkspaceDriveFile(accessToken);
    targetFileId = found?.id || null;
  }

  const sanitized = sanitizeWorkspaceForSync(normalizeWorkspaceState(workspace));
  const payload = JSON.stringify(
    {
      app: 'إدارة البيئة — شركة الدقهلية لصناعة وتكرير السكر',
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      workspace: sanitized,
    },
    null,
    2
  );

  const metadata = targetFileId
    ? { name: DRIVE_FILE_NAME, mimeType: 'application/json' }
    : {
        name: DRIVE_FILE_NAME,
        mimeType: 'application/json',
        description: 'قاعدة بيانات منظومة إدارة البيئة والسلامة المهنية',
      };

  const boundary = 'dakahlia_drive_sync_' + Math.random().toString(36).slice(2);
  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    payload,
    `--${boundary}--`,
  ].join('\r\n');

  const endpoint = targetFileId
    ? `${DRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(targetFileId)}?uploadType=multipart&fields=id,name,modifiedTime`
    : `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name,modifiedTime`;

  const res = await fetch(endpoint, {
    method: targetFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    throw new Error(await parseDriveError(res));
  }

  return (await res.json()) as DriveFileMeta;
}

export async function deleteWorkspaceFromDrive(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(await parseDriveError(res));
  }
}

export const DRIVE_SYNC_FILENAME = DRIVE_FILE_NAME;
