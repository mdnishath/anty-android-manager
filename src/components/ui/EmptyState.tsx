import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="relative mb-5">
        <div
          aria-hidden
          className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-accent/15 via-accent/5 to-transparent blur-xl"
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-border bg-bg-elev shadow-sm">
          <Icon className="h-7 w-7 text-accent" strokeWidth={1.75} />
        </div>
      </div>
      <h3 className="text-base font-semibold tracking-tight text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-fg-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
