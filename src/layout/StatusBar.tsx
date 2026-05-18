import { useEffect, useState } from 'react';
import { Cpu, MemoryStick, Smartphone, Radio, Clock } from 'lucide-react';
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

  // Placeholders until §6.1 wires real data.
  const runningCount = 0;
  const totalCount = 0;
  const ramUsed = 0;
  const ramTotal = 0;
  const cpu = 0;
  const wsConnected = state === 'ready';
  const lastEventLabel = '—';

  const showTimestamp = width >= 1200;
  const showRamDetail = width >= 1000;
  const showCpu = width >= 900;
  const showPhoneDetail = width >= 760;
  const iconsOnly = width < 600;

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-2 border-t border-border bg-bg px-3 text-xs text-fg-muted">
      <div className="flex shrink-0 items-center gap-2">
        <BackendStateDot state={state} showLabel={!iconsOnly} />
      </div>

      {!iconsOnly && (
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip content={`${runningCount} running / ${totalCount} total phones`}>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-3 w-3 text-fg-subtle" strokeWidth={2} />
              {showPhoneDetail ? (
                <>
                  <span className="text-fg">{runningCount}</span>
                  <span className="text-fg-subtle">/{totalCount}</span>
                </>
              ) : (
                <span className="text-fg-subtle">{totalCount}</span>
              )}
            </span>
          </Tooltip>
          <span className="text-border-strong">·</span>
          <Tooltip content={`${ramUsed} / ${ramTotal} GB RAM`}>
            <span className="inline-flex items-center gap-1.5">
              <MemoryStick className="h-3 w-3 text-fg-subtle" strokeWidth={2} />
              {showRamDetail ? (
                <>
                  <span className="text-fg">{ramUsed}</span>
                  <span className="text-fg-subtle">/{ramTotal} GB</span>
                </>
              ) : (
                <span className="text-fg-subtle">{ramUsed} GB</span>
              )}
            </span>
          </Tooltip>
          {showCpu && (
            <>
              <span className="text-border-strong">·</span>
              <Tooltip content={`${cpu} CPU cores allocated`}>
                <span className="inline-flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-fg-subtle" strokeWidth={2} />
                  <span className="text-fg">{cpu}</span>
                </span>
              </Tooltip>
            </>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-3">
        {showTimestamp && (
          <span className="inline-flex items-center gap-1.5 text-fg-subtle">
            <Clock className="h-3 w-3" strokeWidth={2} />
            {lastEventLabel}
          </span>
        )}
        <Tooltip content={wsConnected ? 'WebSocket connected' : 'WebSocket disconnected'}>
          <span className="inline-flex items-center gap-1">
            <Radio
              className={cn(
                'h-3 w-3 transition-colors',
                wsConnected ? 'text-success' : 'text-fg-subtle',
              )}
              strokeWidth={2}
            />
          </span>
        </Tooltip>
      </div>
    </footer>
  );
}
