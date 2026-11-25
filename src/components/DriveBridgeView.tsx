import { useEffect, useState } from 'react';
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import {
  Building2,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  auth,
  formatFirebaseAuthErrorAr,
  googleProvider,
  isFirebaseAuthAvailable,
} from '../lib/firebase';
import {
  preloadGoogleGis,
  requestDriveAccessTokenViaGis,
} from '../lib/googleOAuthFallback';

export interface DriveBridgePayload {
  type: 'DAKAHLIA_DRIVE_BRIDGE_AUTH';
  token: string;
  email: string;
  displayName: string;
  uid: string;
}

export function encodeDriveBridgeCode(payload: DriveBridgePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

export function decodeDriveBridgeCode(raw: string): DriveBridgePayload | null {
  try {
    const clean = raw.trim();
    if (!clean) return null;
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<DriveBridgePayload>;
    if (
      parsed &&
      parsed.type === 'DAKAHLIA_DRIVE_BRIDGE_AUTH' &&
      typeof parsed.token === 'string' &&
      parsed.token.trim().length > 10
    ) {
      return {
        type: 'DAKAHLIA_DRIVE_BRIDGE_AUTH',
        token: parsed.token.trim(),
        email: String(parsed.email || ''),
        displayName: String(parsed.displayName || 'د. أيمن عبد الحميد'),
        uid: String(parsed.uid || 'bridge-user'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function DriveBridgeView() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bridgeCode, setBridgeCode] = useState<string | null>(null);
  const [linkedEmail, setLinkedEmail] = useState<string | null>(null);
  const [sentToOpener, setSentToOpener] = useState(false);
  const [copied, setCopied] = useState(false);
  const [suggestDirectOAuth, setSuggestDirectOAuth] = useState(false);

  useEffect(() => {
    void preloadGoogleGis().catch(() => {
      // ignore offline preload failure
    });

    if (!isFirebaseAuthAvailable || !auth) return;
    let active = true;
    void getRedirectResult(auth)
      .then((cred) => {
        if (!active || !cred) return;
        const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
        const token = oauthCred?.accessToken || '';
        if (!token) {
          setSuggestDirectOAuth(true);
          setError(
            'تم تسجيل الدخول ولكن لم يتم استلام إذن جوجل درايف. اضغط «الربط المباشر البديل عبر Google OAuth» للمتابعة.'
          );
          return;
        }
        finalizePayload({
          type: 'DAKAHLIA_DRIVE_BRIDGE_AUTH',
          token,
          email: cred.user.email || '',
          displayName: cred.user.displayName || 'د. أيمن عبد الحميد',
          uid: cred.user.uid,
        });
      })
      .catch((err) => {
        if (!active) return;
        setSuggestDirectOAuth(true);
        setError(formatFirebaseAuthErrorAr(err));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalizePayload = (payload: DriveBridgePayload) => {
    const code = encodeDriveBridgeCode(payload);
    setBridgeCode(code);
    setLinkedEmail(payload.email || payload.displayName);

    let deliveredToOpener = false;
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, '*');
        deliveredToOpener = true;
      }
    } catch {
      deliveredToOpener = false;
    }

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('dakahlia_drive_bridge');
        bc.postMessage(payload);
        bc.close();
      }
    } catch {
      // ignore
    }

    setSentToOpener(deliveredToOpener);
  };

  const handleAuthorizeViaGis = async () => {
    setBusy(true);
    setError(null);
    try {
      const gisRes = await requestDriveAccessTokenViaGis();
      finalizePayload({
        type: 'DAKAHLIA_DRIVE_BRIDGE_AUTH',
        token: gisRes.token,
        email: gisRes.email,
        displayName: gisRes.displayName,
        uid: gisRes.uid,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر إتمام الربط المباشر بحساب جوجل درايف.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAuthorize = async () => {
    if (!isFirebaseAuthAvailable || !auth || !googleProvider) {
      await handleAuthorizeViaGis();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
      const token = oauthCred?.accessToken || '';
      if (!token) {
        setSuggestDirectOAuth(true);
        setError(
          'لم يتم استلام صلاحية جوجل درايف. اضغط «الربط المباشر عبر Google OAuth» أدناه للمتابعة فوراً.'
        );
        return;
      }

      finalizePayload({
        type: 'DAKAHLIA_DRIVE_BRIDGE_AUTH',
        token,
        email: cred.user.email || '',
        displayName: cred.user.displayName || 'د. أيمن عبد الحميد',
        uid: cred.user.uid,
      });
    } catch (err) {
      setSuggestDirectOAuth(true);
      setError(formatFirebaseAuthErrorAr(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAuthorizeRedirect = async () => {
    if (!isFirebaseAuthAvailable || !auth || !googleProvider) {
      await handleAuthorizeViaGis();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      setSuggestDirectOAuth(true);
      setError(formatFirebaseAuthErrorAr(err));
      setBusy(false);
    }
  };

  const handleCopyCode = async () => {
    if (!bridgeCode) return;
    try {
      await navigator.clipboard.writeText(bridgeCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
              شركة الدقهلية لصناعة وتكرير السكر
            </p>
            <h1 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
              نافذة الربط السحابي بجوجل درايف
            </h1>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          اربط الملف الأوفلاين أو نسخة الـ PWA بحساب جوجل درايف لمزامنة ودمج قاعدة البيانات مباشرة مع السحابة.
        </p>

        {!bridgeCode ? (
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAuthorize()}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-xs text-sm font-bold disabled:opacity-60 transition-colors"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-400" />
              ) : (
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="w-5 h-5 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              )}
              <span>{busy ? 'جاري فتح نافذة جوجل...' : 'اختيار حساب جوجل والربط بجوجل درايف'}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAuthorizeViaGis()}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 ${
                suggestDirectOAuth
                  ? 'bg-blue-700 hover:bg-blue-800 text-white shadow-xs'
                  : 'border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-950/60'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>الربط المباشر البديل عبر Google OAuth</span>
            </button>

            {isFirebaseAuthAvailable && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAuthorizeRedirect()}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>المتابعة في نفس النافذة (بدون نافذة منبثقة)</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-emerald-900 dark:text-emerald-200">
                  تم الاتصال بحساب: {linkedEmail}
                </p>
                <p className="text-emerald-800 dark:text-emerald-300">
                  {sentToOpener
                    ? 'تم إرسال بيانات الربط تلقائياً إلى نافذة الملف الأوفلاين — يمكنك العودة إليها الآن.'
                    : 'انسخ رمز الربط التالي والصقه في نافذة المزامنة بالملف الأوفلاين.'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" />
                  رمز الربط السريع
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'تم النسخ!' : 'نسخ الرمز'}
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={bridgeCode}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300"
              />
            </div>

            <button
              type="button"
              onClick={() => window.close()}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              إغلاق هذه النافذة والعودة للملف
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
