import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { isFileProtocolMode } from './offlineRuntime';

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
] as const;

const fileProtocol = isFileProtocolMode();

let app: FirebaseApp | null = null;
if (!fileProtocol) {
  try {
    app = initializeApp(firebaseConfig);
  } catch {
    app = null;
  }
}

const firestoreDatabaseId = (
  firebaseConfig as { firestoreDatabaseId?: string }
).firestoreDatabaseId;

export const hasFirestoreConfigured = Boolean(
  !fileProtocol && app && firestoreDatabaseId
);

export const db: Firestore = hasFirestoreConfigured && app
  ? (() => {
      try {
        return initializeFirestore(
          app,
          {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            }),
          },
          firestoreDatabaseId
        );
      } catch {
        return null as unknown as Firestore;
      }
    })()
  : (null as unknown as Firestore);

export const auth: Auth = app
  ? (() => {
      try {
        return getAuth(app);
      } catch {
        return null as unknown as Auth;
      }
    })()
  : (null as unknown as Auth);

export const googleProvider: GoogleAuthProvider = app
  ? (() => {
      const provider = new GoogleAuthProvider();
      GOOGLE_DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));
      provider.setCustomParameters({ prompt: 'select_account' });
      return provider;
    })()
  : (null as unknown as GoogleAuthProvider);

export const isFirebaseAuthAvailable = Boolean(app && auth && googleProvider);

// In-memory OAuth access token cache (never stored in localStorage/sessionStorage)
let cachedDriveAccessToken: string | null = null;

export function setDriveAccessToken(token: string | null): void {
  cachedDriveAccessToken = token && token.trim() ? token.trim() : null;
}

export function getDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function formatFirebaseAuthErrorAr(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'تم إغلاق نافذة اختيار حساب جوجل قبل إتمام الربط. اضغط مجدداً لاختيار حسابك.';
  }
  if (raw.includes('auth/cancelled-popup-request')) {
    return 'تم إلغاء الطلب السابق لفتح نافذة جوجل. حاول مرة أخرى.';
  }
  if (raw.includes('auth/popup-blocked')) {
    return 'قام المتصفح بحظر النافذة المنبثقة لحساب جوجل. اسمح بالنوافذ المنبثقة لهذا الموقع أو استخدم رابط الربط المباشر.';
  }
  if (raw.includes('auth/unauthorized-domain')) {
    return 'نطاق التشغيل الحالي غير مضاف في قائمة النطاقات المصرح بها لتسجيل الدخول؛ استخدم نافذة الربط السحابي المباشرة أدناه.';
  }
  if (raw.includes('auth/operation-not-supported-in-this-environment')) {
    return 'بيئة التشغيل المحلية تتطلب فتح نافذة الربط السحابي بجوجل درايف لإتمام الاتصال.';
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'تعذر الاتصال بخدمات جوجل — تحقق من اتصال الإنترنت أو أعد المحاولة فور عودة الاتصال.';
  }
  if (raw.includes('auth/operation-not-allowed')) {
    return 'تسجيل الدخول بحساب جوجل غير مفعّل بعد في إعدادات المشروع.';
  }
  return raw || 'تعذر تسجيل الدخول بحساب جوجل. يمكنك المتابعة في الوضع المحلي أوفلاين.';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  if (fileProtocol || !hasFirestoreConfigured || !db) {
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.warn('Offline mode active: using cached local persistence.');
    }
  }
}
