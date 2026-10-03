import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MyCinema ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Error clearing caches:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090B] text-[#F5F3EB] flex items-center justify-center p-6 selection:bg-[#E0AD52] selection:text-[#09090B]">
          <div className="max-w-md w-full bg-[#131319] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#E0AD52]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="mx-auto flex items-center justify-center">
              <BrandLogo variant="symbol" size={54} alt="MYCINEMA" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#F5F3EB]">
                Intermission
              </h1>
              <p className="text-xs text-[#9E9DA5] leading-relaxed">
                Something went wrong showing this screen. Your saved titles are safe.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-left text-[11px] font-mono text-red-400 overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#E0AD52] text-[#09090B] font-semibold text-xs tracking-wider uppercase hover:bg-[#D99C33] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-[#E0AD52]/10"
              >
                <RefreshCw size={14} />
                Reload
              </button>

              <button
                onClick={this.handleResetCache}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-[#9E9DA5] hover:text-[#F5F3EB] hover:bg-white/10 font-medium text-xs tracking-wider uppercase active:scale-[0.98] transition-all cursor-pointer"
              >
                <Trash2 size={14} />
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
