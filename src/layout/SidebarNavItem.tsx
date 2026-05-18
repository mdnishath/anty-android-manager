import type { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/cn';
import { preload } from '@/router/preload';
import { useReducedMotionSafe } from '@/hooks/useReducedMotionSafe';

interface Props {
  icon: LucideIcon;
  label: string;
  to: string;
  badge?: number | string;
  collapsed: boolean;
  preloadId?: string;
}

export function SidebarNavItem({ icon: Icon, label, to, badge, collapsed, preloadId }: Props) {
  const reduced = useReducedMotionSafe();
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  const onHover = () => {
    if (preloadId) preload(preloadId);
  };

  const content = (
    <Link
      to={to}
      onMouseEnter={onHover}
      onFocus={onHover}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 items-center rounded-md text-sm font-medium transition-all',
        collapsed ? 'mx-2 justify-center' : 'mx-0 gap-3 px-2',
        isActive ? 'bg-accent/15 text-fg' : 'text-fg-muted hover:bg-bg-elev-2 hover:text-fg',
      )}
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-active-bar"
          className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent -left-2"
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0 transition-colors',
          isActive ? 'text-accent' : 'text-fg-muted group-hover:text-fg',
        )}
        strokeWidth={2}
      />
      {!collapsed && (
        <>
          <motion.span
            animate={{ opacity: 1, x: 0 }}
            initial={{ opacity: 0, x: -4 }}
            transition={reduced ? { duration: 0 } : { duration: 0.15 }}
            className="flex-1 truncate"
          >
            {label}
          </motion.span>
          {badge !== undefined && (
            <Badge variant={isActive ? 'accent' : 'muted'} size="sm">
              {badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip content={label} side="right" delayDuration={400}>
        {content}
      </Tooltip>
    );
  }

  return content;
}
