import { Building2, HardDrive, ShieldCheck } from 'lucide-react';

interface AuthGateProps {
  onSignIn: () => void;
  onEnterLocalMode: () => void;
  isSigningIn: boolean;
  authError: string | null;
}

export function AuthGate({
  onSignIn,
  onEnterLocalMode,
  isSigningIn,
  authError,
}: AuthGateProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-8 space-y-6">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
              إدارة البيئة — السكرتارية
            </h1>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mt-0.5">
              شركة الدقهلية لصناعة وتكرير السكر
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              د. أيمن عبد الحميد — دكتوراه في الكيمياء والسلامة المهنية
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            مزايا المنظومة المتكاملة:
          </p>
          <ul className="list-disc pr-5 space-y-1">
            <li>مراسلات خارجية، مذكرات المصنع (صادر ووارد)، والإدارات الفرعية الأربع.</li>
            <li>رسائل الماجستير والدكتوراه في الكيمياء والسلامة المهنية بالتسلسل السريع.</li>
            <li>مذكرة الأعمال والتكليفات، المسودات، والطباعة على مقاس A4 أو التصدير إلى Word.</li>
            <li>العمل أونلاين بالربط والمزامنة مع جوجل درايف أو أوفلاين على الجهاز في أي وقت.</li>
          </ul>
        </div>

        {authError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-2"
          >
            <p className="font-semibold leading-relaxed">{authError}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                disabled={isSigningIn}
                onClick={onSignIn}
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold transition-colors disabled:opacity-60"
              >
                إعادة فتح نافذة اختيار حساب جوجل
              </button>
              <button
                type="button"
                onClick={onEnterLocalMode}
                className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-red-800 dark:text-red-200 font-semibold hover:bg-red-100/60 dark:hover:bg-red-950/60 transition-colors"
              >
                متابعة في الوضع المحلي مؤقتاً
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            disabled={isSigningIn}
            onClick={onSignIn}
            className="w-full py-3 px-4 rounded-xl bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-xs text-sm font-bold flex items-center justify-center gap-2.5 transition-colors"
          >
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
            <span>
              {isSigningIn
                ? 'جاري فتح نافذة جوجل ومزامنة جوجل درايف...'
                : 'اختيار حساب جوجل والمزامنة مع جوجل درايف'}
            </span>
          </button>

          <button
            type="button"
            onClick={onEnterLocalMode}
            className="w-full py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <HardDrive className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>الدخول في الوضع المحلي بدون إنترنت (أوفلاين)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
