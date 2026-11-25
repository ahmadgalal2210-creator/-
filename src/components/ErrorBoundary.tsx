import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6"
        >
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-xl p-6 space-y-4 text-right">
            <h1 className="font-display text-lg font-bold text-red-700 dark:text-red-400">
              حدث خطأ غير متوقع في مساحة العمل
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
