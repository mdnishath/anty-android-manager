import { cn } from '@/lib/cn';
import type { SidecarState } from '@shared/ipc-schemas';

const labels: Record<SidecarState, string> = {
  starting: 'starting',
  ready: 'ready',
  exited: 'exited',
  error: 'error',
};

const colors: Record<SidecarState, string> = {
  starting: 'bg-warning',
  ready: 'bg-success',
  exited: 'bg-fg-subtle',
  error: 'bg-danger',
};

export function BackendStateDot({ state, showLabel = true }: { state: SidecarState; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
      <span
        aria-hidden
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          colors[state],
          state === 'starting' && 'animate-pulse',
        )}
      />
      <span className="sr-only">backend status:</span>
      {showLabel && <span>backend: {labels[state]}</span>}
    </span>
  );
}
