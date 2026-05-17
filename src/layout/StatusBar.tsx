import { useEffect, useState } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { BackendStateDot } from '@/components/BackendStateDot';
import { useBackendState } from '@/hooks/useBackendState';
import { cn } from '@/lib/cn';

function useWindowWidth(): number {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

export function StatusBar() {
  const state = useBackendState();
  const width = useWindowWidth();

  // Phone counts + capacity are placeholders until §6.1 wires real data.
  const runningCount = 0;
  const totalCount = 0;
  const ramUsed = 0;
  const ramTotal = 0;
  const cpu = 0;
  const wsConnected = state === 'ready';
  const lastEventLabel = '—';

  const showTimestamp = width >= 1100;
  const showRamDetail = width >= 950;
  const showCpu = width >= 850;
  const showPhoneDetail = width >= 700;
  const iconsOnly = width < 700;

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-bg px-4 text-xs text-fg-muted">
      <div className="flex items-center gap-3">
        <BackendStateDot state={state} showLabel={!iconsOnly} />
      </div>

      {!iconsOnly && (
        <div className="flex items-center gap-3 text-xs">
          {showPhoneDetail ? (
            <span>
              <span className="text-fg">{runningCount}</span>
              <span className="text-fg-subtle"> running / </span>
              <span className="text-fg">{totalCount}</span>
              <span className="text-fg-subtle"> total</span>
            </span>
          ) : (
            <Tooltip content={`${runningCount} running / ${totalCount} total phones`}>
              <span className="text-fg-subtle">phones</span>
            </Tooltip>
          )}
          <span className="text-fg-subtle">·</span>
          {showRamDetail ? (
            <span>
              <span className="text-fg">{ramUsed}</span>
              <span className="text-fg-subtle"> / {ramTotal} GB RAM</span>
            </span>
          ) : (
            <Tooltip content={`${ramUsed} / ${ramTotal} GB RAM`}>
              <span className="text-fg-subtle">RAM</span>
            </Tooltip>
          )}
          {showCpu && (
            <>
              <span className="text-fg-subtle">·</span>
              <span className="text-fg">{cpu} CPU</span>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Tooltip content={wsConnected ? 'Connected' : 'Disconnected'}>
          <span
            aria-hidden
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              wsConnected ? 'bg-success' : 'bg-fg-subtle',
            )}
          />
        </Tooltip>
        {showTimestamp && <span className="text-fg-subtle">last event: {lastEventLabel}</span>}
      </div>
    </footer>
  );
}
