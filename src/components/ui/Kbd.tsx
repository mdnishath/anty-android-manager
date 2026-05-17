import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Kbd({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border-strong bg-bg-elev px-1.5 font-mono text-[10px] font-medium leading-none text-fg-muted',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
