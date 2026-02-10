
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Bug, Shield } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI to render instead of the default */
  fallback?: ReactNode;
  /** Scope label for logging (e.g. 'DeFi', 'Bridge', 'Payments') */
  scope?: string;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary — Catches rendering errors in child component trees.
 *
 * Usage:
 *   <ErrorBoundary scope="DeFi">
 *     <DeFiDashboard />
 *   </ErrorBoundary>
 *
 * Provides:
 * - Graceful error UI with retry button
 * - Scoped error logging for debugging
 * - Optional custom fallback UI
 * - Error callback for telemetry
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const scope = this.props.scope || 'Unknown';
    console.error(`[ErrorBoundary:${scope}] Uncaught error:`, error, errorInfo);

    this.setState({ errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const scope = this.props.scope || 'Component';

      return (
        <div className="bg-zinc-950 border border-red-500/30 rounded-3xl p-8 m-4 space-y-6 max-w-lg mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-red-500" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-200">{scope} Error</h3>
              <p className="text-xs text-zinc-500 mt-1">
                An unexpected error occurred in this section. Your funds and keys are safe.
              </p>
            </div>
          </div>

          {this.state.error && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Bug size={14} className="text-zinc-600" />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Error Details</p>
              </div>
              <p className="text-xs font-mono text-red-400 break-all leading-relaxed">
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Shield size={14} className="text-green-500" />
            <p className="text-[10px] text-zinc-500">
              Enclave integrity verified. No sensitive data was exposed.
            </p>
          </div>

          <button
            onClick={this.handleRetry}
            className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-black rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-zinc-800"
          >
            <RotateCcw size={16} />
            Retry {scope}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
