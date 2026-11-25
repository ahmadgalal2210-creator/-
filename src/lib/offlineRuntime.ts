import type { WorkspaceState } from '../types';
import { EMPTY_WORKSPACE, normalizeWorkspaceState } from './localWorkspaceService';

export const DEFAULT_CLOUD_ORIGIN =
  'https://ais-pre-zhh6eoya4kandu5vutpdfa-186203223876.europe-west1.run.app';

export function isFileProtocolMode(): boolean {
  if (typeof window === 'undefined') return false;
  return !/^https?:$/i.test(window.location.protocol);
}

export function isStandaloneOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __OFFLINE_HTML_MODE__?: boolean };
  return isFileProtocolMode() || Boolean(w.__OFFLINE_HTML_MODE__);
}

export function getCloudSyncOrigin(): string {
  if (typeof document !== 'undefined') {
    const meta = document
      .querySelector('meta[name="cloud-sync-origin"]')
      ?.getAttribute('content')
      ?.trim();
    if (meta && /^https?:\/\//i.test(meta)) {
      return meta.replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __CLOUD_SYNC_ORIGIN__?: string };
    if (w.__CLOUD_SYNC_ORIGIN__ && /^https?:\/\//i.test(w.__CLOUD_SYNC_ORIGIN__)) {
      return w.__CLOUD_SYNC_ORIGIN__.replace(/\/+$/, '');
    }
    if (/^https?:$/i.test(window.location.protocol)) {
      return window.location.origin.replace(/\/+$/, '');
    }
  }
  return DEFAULT_CLOUD_ORIGIN;
}

export function readEmbeddedOfflineSeed(): WorkspaceState | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('offline-seed-data');
  if (!el) return null;
  const raw = (el.textContent || '').trim();
  if (!raw || raw === '__OFFLINE_SEED_JSON__') return null;
  try {
    return normalizeWorkspaceState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function buildLightweightWorkspaceForExport(ws: WorkspaceState): WorkspaceState {
  const clean = normalizeWorkspaceState(ws);
  return {
    ...EMPTY_WORKSPACE,
    ...clean,
    // Keep database light: avoid duplicating large base64 dataUrl when thumbnailDataUrl exists
    images: clean.images.map((img) => {
      const thumb = (img.thumbnailDataUrl || img.dataUrl || '').slice(0, 60000);
      return {
        ...img,
        thumbnailDataUrl: thumb,
        dataUrl: undefined,
      };
    }),
    files: clean.files.map((f) => ({
      ...f,
      extractedText: (f.extractedText || '').slice(0, 12000),
    })),
  };
}
