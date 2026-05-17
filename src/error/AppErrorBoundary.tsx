import { ErrorBoundary } from 'react-error-boundary';
import type { ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';
import { getCpSafe } from '@/ipc';

function handleError(error: Error, info: { componentStack?: string | null }) {
  const cp = getCpSafe();
  if (!cp) return;
  void cp.reportError({
    message: error.message,
    stack: error.stack,
    componentStack: info.componentStack ?? undefined,
    appVersion: cp.app.version,
    ts: Date.now(),
  });
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={handleError}
      fallbackRender={(props) => (
        <div className="min-h-screen bg-bg p-6">
          <ErrorFallback {...props} variant="app" />
        </div>
      )}
      onReset={() => {
        void getCpSafe()?.restartApp();
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
