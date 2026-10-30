import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#070b16]">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card dark:border-white/10 dark:bg-slate-900">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-[16px] font-bold text-slate-900 dark:text-white">Something broke in the interface</h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            The action was interrupted before it could finish. Reload the page to continue — your saved data is unaffected.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2.5 text-left text-[10.5px] text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-primary btn-md mt-4 w-full"
          >
            <RefreshCw className="h-4 w-4" /> Reload application
          </button>
        </div>
      </div>
    );
  }
}
