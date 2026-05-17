import { ErrorBoundary } from 'react-error-boundary';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';
import { getCpSafe } from '@/ipc';

function handleError(error: Error, info: { componentStack?: string | null }, route: string) {
  const cp = getCpSafe();
  if (!cp) return;
  void cp.reportError({
    message: error.message,
    stack: error.stack,
    componentStack: info.componentStack ?? undefined,
    route,
    appVersion: cp.app.version,
    ts: Date.now(),
  });
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <ErrorBoundary
      resetKeys={[location.pathname]}
      onError={(err, info) => handleError(err, info, location.pathname)}
      fallbackRender={(props) => (
        <div className="p-6">
          <ErrorFallback {...props} variant="route" onHome={() => navigate('/dashboard')} />
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
