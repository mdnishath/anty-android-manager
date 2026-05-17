import { Minus, Square, X } from 'lucide-react';
import { cn } from '@/lib/cn';

function isMac() {
  return typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
}

export function TitleBar() {
  // On macOS we render a thin drag region; native traffic lights are provided by the OS via titleBarStyle: hiddenInset.
  // On Windows/Linux we render placeholder buttons (no-op for now — real wiring needs an IPC channel).
  const mac = isMac();
  return (
    <div
      className={cn(
        'drag-region flex h-8 shrink-0 items-center justify-between border-b border-border bg-bg',
        mac ? 'pl-20 pr-2' : 'pl-3 pr-0',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-fg-subtle">CloudPhone Manager</div>
      {!mac && (
        <div className="no-drag flex h-8">
          <button
            type="button"
            aria-label="Minimize"
            className="flex h-8 w-12 items-center justify-center text-fg-muted hover:bg-bg-elev-2"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Maximize"
            className="flex h-8 w-12 items-center justify-center text-fg-muted hover:bg-bg-elev-2"
          >
            <Square className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Close"
            className="flex h-8 w-12 items-center justify-center text-fg-muted hover:bg-danger hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
