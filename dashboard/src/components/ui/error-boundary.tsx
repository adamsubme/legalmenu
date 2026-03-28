'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional title for the error */
  title?: string;
  /** Callback when user clicks retry */
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary — catches React errors in child tree.
 * Prevents entire page from crashing on component-level errors.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <DefaultErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
}

function DefaultErrorFallback({ error, onRetry }: DefaultErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-100 mb-2">Something went wrong</h3>
      <p className="text-sm text-zinc-500 max-w-md mb-4">
        {error?.message || 'An unexpected error occurred'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-zinc-800 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <Home className="h-4 w-4" />
          Go home
        </a>
      </div>
    </div>
  );
}

/**
 * Hook version for functional components that need error boundary behavior.
 * Use with Suspense for async data loading.
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => setError(null), []);

  const throwError = React.useCallback((err: Error) => {
    setError(err);
    throw err;
  }, []);

  if (error) {
    throw error;
  }

  return { throwError, resetError };
}
