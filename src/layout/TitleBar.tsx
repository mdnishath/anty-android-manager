import { useEffect, useState } from 'react';
import { Minus, X, Square } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getCpSafe } from '@/ipc';

function isMac() {
  return typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
}

export function TitleBar() {
  const mac = isMac();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const cp = getCpSafe();
    if (!cp) return;
    void cp.winIsMaximized().then(setMaximized);
    return cp.onMaximizedChanged(setMaximized);
  }, []);

  const onMin = () => void getCpSafe()?.winMinimize();
  const onMaxToggle = () => {
    const cp = getCpSafe();
    if (!cp) return;
    void (maximized ? cp.winUnmaximize() : cp.winMaximize());
  };
  const onClose = () => void getCpSafe()?.winClose();

  return (
    <div
      className={cn(
        'drag-region flex h-8 shrink-0 items-center justify-between border-b border-border bg-bg',
        mac ? 'pl-20 pr-2' : 'pl-3 pr-0',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-accent-strong">
          <svg
            viewBox="0 0 24 24"
            className="h-2.5 w-2.5 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="3" width="12" height="18" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18" />
          </svg>
        </div>
        <span className="text-[11px] font-medium tracking-tight text-fg-muted">CloudPhone Manager</span>
      </div>
      {!mac && (
        <div className="no-drag flex h-8">
          <button
            type="button"
            aria-label="Minimize"
            onClick={onMin}
            className="flex h-8 w-11 items-center justify-center text-fg-muted transition-colors hover:bg-bg-elev-2 hover:text-fg"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={onMaxToggle}
            className="flex h-8 w-11 items-center justify-center text-fg-muted transition-colors hover:bg-bg-elev-2 hover:text-fg"
          >
            {maximized ? <RestoreIcon className="h-3 w-3" /> : <Square className="h-3 w-3" strokeWidth={2} />}
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-11 items-center justify-center text-fg-muted transition-colors hover:bg-danger hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function RestoreIcon({ className }: { className?: string }) {
  // Two overlapping squares — proper "restore" iconography
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="3" y="1" width="8" height="8" rx="0.5" />
      <rect x="1" y="3" width="8" height="8" rx="0.5" fill="hsl(var(--bg))" />
    </svg>
  );
}
