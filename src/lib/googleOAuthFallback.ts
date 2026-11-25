import firebaseConfig from '../../firebase-applet-config.json';
import { GOOGLE_DRIVE_SCOPES } from './firebase';

interface GisTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleOAuth2Global {
  accounts?: {
    oauth2?: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        prompt?: string;
        callback: (resp: GisTokenResponse) => void;
        error_callback?: (err: { type?: string; message?: string }) => void;
      }) => GisTokenClient;
    };
  };
}

export interface GisDriveAuthResult {
  token: string;
  email: string;
  displayName: string;
  uid: string;
}

let gisLoadPromise: Promise<void> | null = null;

export function isGisScriptReady(): boolean {
  if (typeof window === 'undefined') return false;
  const g = (window as unknown as { google?: GoogleOAuth2Global }).google;
  return Boolean(g?.accounts?.oauth2?.initTokenClient);
}

export function preloadGoogleGis(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google OAuth unavailable outside browser'));
  }
  if (isGisScriptReady()) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      if (isGisScriptReady()) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => {
          gisLoadPromise = null;
          reject(new Error('تعذر تحميل خدمة تسجيل دخول جوجل'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('تعذر الاتصال بخدمة جوجل OAuth — تأكد من الاتصال بالإنترنت'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

export async function requestDriveAccessTokenViaGis(): Promise<GisDriveAuthResult> {
  const clientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId?.trim();
  if (!clientId) {
    throw new Error('معرّف عميل جوجل OAuth غير مهيأ في إعدادات المشروع.');
  }

  await preloadGoogleGis();
  const g = (window as unknown as { google?: GoogleOAuth2Global }).google;
  const initTokenClient = g?.accounts?.oauth2?.initTokenClient;
  if (!initTokenClient) {
    throw new Error('تعذر تهيئة عميل جوجل OAuth في المتصفح.');
  }

  const scope = [
    ...GOOGLE_DRIVE_SCOPES,
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');

  const token = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const client = initTokenClient({
      client_id: clientId,
      scope,
      prompt: 'select_account',
      callback: (resp) => {
        if (settled) return;
        settled = true;
        if (resp.error || !resp.access_token) {
          reject(
            new Error(
              resp.error === 'access_denied'
                ? 'تم رفض منح صلاحية جوجل درايف. يرجى الموافقة للمتابعة.'
                : resp.error_description || 'لم يتم استلام صلاحية جوجل درايف.'
            )
          );
          return;
        }
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        if (err?.type === 'popup_closed') {
          reject(
            new Error(
              'تم إغلاق نافذة اختيار حساب جوجل قبل إتمام الربط. اضغط مجدداً واختر حسابك.'
            )
          );
          return;
        }
        if (err?.type === 'popup_failed_to_open') {
          reject(
            new Error(
              'قام المتصفح بحظر نافذة اختيار حساب جوجل. اسمح بالنوافذ المنبثقة لهذا الموقع.'
            )
          );
          return;
        }
        reject(new Error(err?.message || 'تعذر فتح نافذة المصادقة مع جوجل.'));
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });

  let email = '';
  let displayName = 'د. أيمن عبد الحميد';
  let uid = 'google-drive-user';
  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (infoRes.ok) {
      const info = (await infoRes.json()) as {
        sub?: string;
        email?: string;
        name?: string;
      };
      email = info.email || '';
      displayName = info.name || info.email || displayName;
      uid = info.sub || uid;
    }
  } catch {
    // Userinfo is optional; token itself grants Drive file access
  }

  return { token, email, displayName, uid };
}
