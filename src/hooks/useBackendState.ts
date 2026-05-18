import { useEffect, useState } from 'react';
import type { SidecarState } from '@shared/ipc-schemas';
import { getCpSafe } from '@/ipc';

export function useBackendState(): SidecarState {
  const [state, setState] = useState<SidecarState>('starting');

  useEffect(() => {
    const cp = getCpSafe();
    if (!cp) return;
    let cancelled = false;
    // Pull the current state on mount in case the sidecar settled before
    // the renderer was ready to receive the change event.
    cp.sidecarState().then((s) => {
      if (!cancelled) setState(s);
    });
    const unsub = cp.onSidecarState((s) => setState(s));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return state;
}
