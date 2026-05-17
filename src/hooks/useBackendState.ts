import { useEffect, useState } from 'react';
import type { SidecarState } from '@shared/ipc-schemas';
import { getCpSafe } from '@/ipc';

export function useBackendState(): SidecarState {
  const [state, setState] = useState<SidecarState>('starting');

  useEffect(() => {
    const cp = getCpSafe();
    if (!cp) return;
    const unsub = cp.onSidecarState((s) => setState(s));
    return unsub;
  }, []);

  return state;
}
