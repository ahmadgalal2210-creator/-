import type { WorkspaceState } from '../types';
import {
  buildLightweightWorkspaceForExport,
  getCloudSyncOrigin,
  isStandaloneOfflineMode,
} from './offlineRuntime';

const CACHE_NAME = 'dakahlia-offline-assets-v3';
const TEMPLATE_URL = '/offline-template.html';
const MANIFEST_URL = '/manifest.webmanifest';
const IDB_NAME = 'dakahlia_offline_templates_v3';
const IDB_STORE = 'templates';

const FALLBACK_MANIFEST = {
  id: '/',
  name: 'درايمانب',
  short_name: 'Draymanb',
  description:
    'منظومة إدارة البيئة والسلامة المهنية لشركة الدقهلية لصناعة وتكرير السكر — د. أيمن عبد الحميد.',
  theme_color: '#0F172A',
  background_color: '#F8FAFC',
  display: 'standalone',
  dir: 'rtl',
  lang: 'ar',
  start_url: '/',
  scope: '/',
  icons: [
    {
      src: '/pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/pwa-maskable-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

function openTemplateDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveTemplateToIdb(key: string, value: string): Promise<void> {
  try {
    const db = await openTemplateDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Non-blocking fallback
  }
}

async function readTemplateFromIdb(key: string): Promise<string | null> {
  try {
    const db = await openTemplateDb();
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () =>
        resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveTextToCacheStorage(url: string, text: string, contentType: string): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      url,
      new Response(text, {
        status: 200,
        headers: { 'Content-Type': contentType },
      })
    );
  } catch {
    // Non-blocking fallback
  }
}

async function readTextFromCacheStorage(url: string): Promise<string | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const match = await caches.match(url, { ignoreSearch: true });
    if (!match || !match.ok) return null;
    return await match.text();
  } catch {
    return null;
  }
}

function safeJsonForHtmlScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function injectSeedIntoTemplate(
  templateHtml: string,
  workspace: WorkspaceState
): string {
  const lightWs = buildLightweightWorkspaceForExport(workspace);
  const payloadJson = safeJsonForHtmlScript(lightWs);

  if (templateHtml.includes('__OFFLINE_SEED_JSON__')) {
    return templateHtml.replace('__OFFLINE_SEED_JSON__', () => payloadJson);
  }

  return templateHtml.replace(
    /(<script\s+id="offline-seed-data"\s+type="application\/json">)[\s\S]*?(<\/script>)/i,
    (_m, openTag, closeTag) => `${openTag}${payloadJson}${closeTag}`
  );
}

const CLOUD_ORIGIN_META_RE =
  /<meta\s+name=["']cloud-sync-origin["']\s+content=["'][^"']*["']\s*\/?>/i;

function ensureCloudOriginMetaInHtml(html: string): string {
  const origin = getCloudSyncOrigin().replace(/"/g, '&quot;');
  const metaTag = `<meta name="cloud-sync-origin" content="${origin}" />`;
  if (CLOUD_ORIGIN_META_RE.test(html)) {
    return html.replace(CLOUD_ORIGIN_META_RE, metaTag);
  }
  return html.replace('</head>', `  ${metaTag}\n  </head>`);
}

function ensurePwaMetaInHtml(html: string): string {
  let out = ensureCloudOriginMetaInHtml(html);
  if (!out.includes('mobile-web-app-capable')) {
    out = out.replace(
      '</head>',
      `  <meta name="mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="default" />\n    <meta name="apple-mobile-web-app-title" content="درايمانب" />\n  </head>`
    );
  }
  return out;
}

export async function primeOfflineDownloadCache(): Promise<void> {
  if (typeof window === 'undefined' || isStandaloneOfflineMode()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const bust = `?v=${Date.now()}`;
  try {
    const tplRes = await fetch(`${TEMPLATE_URL}${bust}`, { cache: 'no-store' });
    if (tplRes.ok) {
      const tplText = await tplRes.text();
      if (
        tplText.includes('offline-seed-data') &&
        tplText.includes('DAKAHLIA_DRIVE_BRIDGE_AUTH') &&
        tplText.includes('__CLOUD_SYNC_ORIGIN__')
      ) {
        await saveTextToCacheStorage(
          TEMPLATE_URL,
          tplText,
          'text/html; charset=utf-8'
        );
        await saveTemplateToIdb(TEMPLATE_URL, tplText);
      }
    }
  } catch {
    // Ignore transient prefetch failure
  }

  try {
    const mfRes = await fetch(`${MANIFEST_URL}${bust}`, { cache: 'no-store' });
    if (mfRes.ok) {
      const mfText = await mfRes.text();
      await saveTextToCacheStorage(
        MANIFEST_URL,
        mfText,
        'application/manifest+json; charset=utf-8'
      );
      await saveTemplateToIdb(MANIFEST_URL, mfText);
    }
  } catch {
    // Ignore transient prefetch failure
  }
}

async function resolveOfflineTemplateHtml(): Promise<string> {
  // 1. Try network when online (bypassing any stale SW route via query param)
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (isOnline) {
    try {
      const res = await fetch(`${TEMPLATE_URL}?v=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const text = await res.text();
        if (
          text.includes('offline-seed-data') &&
          text.includes('DAKAHLIA_DRIVE_BRIDGE_AUTH') &&
          text.includes('__CLOUD_SYNC_ORIGIN__')
        ) {
          void saveTextToCacheStorage(
            TEMPLATE_URL,
            text,
            'text/html; charset=utf-8'
          );
          void saveTemplateToIdb(TEMPLATE_URL, text);
          return text;
        }
      }
    } catch {
      // Fall through to offline caches
    }
  }

  // 2. Fallback to Cache Storage (works 100% offline via SW or primed cache)
  const fromCache = await readTextFromCacheStorage(TEMPLATE_URL);
  if (
    fromCache &&
    fromCache.includes('offline-seed-data') &&
    fromCache.includes('DAKAHLIA_DRIVE_BRIDGE_AUTH') &&
    fromCache.includes('__CLOUD_SYNC_ORIGIN__')
  ) {
    return fromCache;
  }

  // 3. Fallback to IndexedDB template store (works offline even without SW)
  const fromIdb = await readTemplateFromIdb(TEMPLATE_URL);
  if (
    fromIdb &&
    fromIdb.includes('offline-seed-data') &&
    fromIdb.includes('DAKAHLIA_DRIVE_BRIDGE_AUTH') &&
    fromIdb.includes('__CLOUD_SYNC_ORIGIN__')
  ) {
    return fromIdb;
  }

  // 4. Final network attempt even if navigator.onLine misreported
  try {
    const lastTry = await fetch(`${TEMPLATE_URL}?v=${Date.now()}`, {
      cache: 'no-store',
    });
    if (lastTry.ok) {
      const text = await lastTry.text();
      if (text.includes('offline-seed-data')) {
        void saveTextToCacheStorage(
          TEMPLATE_URL,
          text,
          'text/html; charset=utf-8'
        );
        void saveTemplateToIdb(TEMPLATE_URL, text);
        return text;
      }
    }
  } catch {
    // Exhausted all sources
  }

  throw new Error(
    'تعذر العثور على قالب النسخة الأوفلاين في الذاكرة المؤقتة؛ افتح التطبيق أونلاين مرة واحدة لحفظ القالب.'
  );
}

export async function buildStandaloneOfflineHtml(
  workspace: WorkspaceState,
  options?: { pwaEnhanced?: boolean }
): Promise<string> {
  // If already running inside an exported standalone offline HTML file,
  // clone the current clean template shell without bloating the DOM.
  if (isStandaloneOfflineMode() && typeof document !== 'undefined') {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    const rootEl = clone.querySelector('#root');
    if (rootEl) rootEl.innerHTML = '';
    const seedEl = clone.querySelector('#offline-seed-data');
    if (seedEl) {
      seedEl.textContent = safeJsonForHtmlScript(
        buildLightweightWorkspaceForExport(workspace)
      );
    }
    const raw = `<!doctype html>\n${clone.outerHTML}`;
    return options?.pwaEnhanced
      ? ensurePwaMetaInHtml(raw)
      : ensureCloudOriginMetaInHtml(raw);
  }

  const templateHtml = await resolveOfflineTemplateHtml();
  const injected = injectSeedIntoTemplate(templateHtml, workspace);
  return options?.pwaEnhanced
    ? ensurePwaMetaInHtml(injected)
    : ensureCloudOriginMetaInHtml(injected);
}

export async function getManifestJsonString(): Promise<string> {
  if (!isStandaloneOfflineMode()) {
    try {
      const res = await fetch(MANIFEST_URL);
      if (res.ok) {
        const txt = await res.text();
        void saveTextToCacheStorage(
          MANIFEST_URL,
          txt,
          'application/manifest+json; charset=utf-8'
        );
        void saveTemplateToIdb(MANIFEST_URL, txt);
        return txt;
      }
    } catch {
      // Fallback to cache / built-in manifest
    }
    const cached =
      (await readTextFromCacheStorage(MANIFEST_URL)) ||
      (await readTemplateFromIdb(MANIFEST_URL));
    if (cached) return cached;
  }
  return JSON.stringify(FALLBACK_MANIFEST, null, 2);
}

export function triggerBlobDownload(
  content: BlobPart,
  fileName: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
