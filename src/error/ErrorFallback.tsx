import type { FallbackProps } from 'react-error-boundary';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props extends FallbackProps {
  variant?: 'app' | 'route';
  onHome?: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary, variant = 'route', onHome }: Props) {
  const isApp = variant === 'app';
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-4 rounded-lg border border-danger/40 bg-danger-bg/40 p-6',
        isApp && 'min-h-screen items-center justify-center',
      )}
    >
      <div className={cn('flex w-full', isApp ? 'max-w-lg flex-col items-start gap-4' : 'gap-4')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-fg">
              {isApp ? 'Something went wrong' : 'This page crashed'}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              {error?.message ?? 'An unexpected error occurred.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetErrorBoundary}
              className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-bg-elev px-3 py-1.5 text-sm font-medium hover:bg-bg-elev-2"
            >
              <RefreshCw className="h-4 w-4" />
              {isApp ? 'Reload app' : 'Retry'}
            </button>
            {!isApp && onHome && (
              <button
                type="button"
                onClick={onHome}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm font-medium hover:bg-bg-elev"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
