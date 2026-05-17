import type { LucideIcon } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const reduced = useReducedMotionSafe();
  const onHover = () => {
    if (preloadId) preload(preloadId);
  };

  const content = (
    <NavLink
      to={to}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={(e) => {
        // ensure preloaded
        if (preloadId) preload(preloadId);
        // Allow normal navigation
        if (e.metaKey || e.ctrlKey) return;
      }}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-md px-2 text-sm transition-colors',
          isActive ? 'bg-bg-elev-2 text-fg' : 'text-fg-muted hover:bg-bg-elev-2/60 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent"
              transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          <motion.span
            animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -4 : 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.15 }}
            className={cn('flex-1 truncate', collapsed && 'pointer-events-none')}
          >
            {label}
          </motion.span>
          {badge !== undefined && !collapsed && (
            <Badge variant="muted" size="sm">
              {badge}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip content={label} side="right">
        <div onClick={() => navigate(to)}>{content}</div>
      </Tooltip>
    );
  }

  return content;
}
