import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-none',
  {
    variants: {
      variant: {
        default: 'bg-bg-elev-2 text-fg-muted border border-border',
        success: 'bg-success-bg text-success border border-success/30',
        warning: 'bg-warning-bg text-warning border border-warning/30',
        danger: 'bg-danger-bg text-danger border border-danger/30',
        info: 'bg-info-bg text-info border border-info/30',
        muted: 'bg-bg-elev text-fg-subtle border border-border',
        accent: 'bg-accent/10 text-accent border border-accent/30',
      },
      size: {
        sm: 'h-5 px-1.5 text-[10px]',
        md: 'h-6 px-2 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size, className }))} {...props} />;
}
