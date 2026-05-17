import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Smartphone,
  Camera,
  Package,
  Network,
  Fingerprint,
  Workflow,
  ScrollText,
  Settings as SettingsIcon,
  PanelLeft,
  PanelLeftClose,
  CircleUser,
} from 'lucide-react';
import { useUiStore } from '@/store/ui';
import { useShortcut } from '@/hooks/useShortcut';
import { useReducedMotionSafe } from '@/hooks/useReducedMotionSafe';
import { useBackendState } from '@/hooks/useBackendState';
import { useEffect } from 'react';
import { SidebarNavItem } from './SidebarNavItem';
import { IconButton } from '@/components/ui/IconButton';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { BackendStateDot } from '@/components/BackendStateDot';
import { cn } from '@/lib/cn';

const W_EXPANDED = 240;
const W_COLLAPSED = 64;

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const backendState = useBackendState();
  const reduced = useReducedMotionSafe();

  useShortcut('mod+b', toggle);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 900 && !collapsed) setCollapsed(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <motion.aside
        animate={{ width: collapsed ? W_COLLAPSED : W_EXPANDED }}
        transition={reduced ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
        className="flex h-full shrink-0 flex-col border-r border-border bg-bg-elev"
        aria-label="Primary"
      >
        <div className="flex h-12 items-center justify-between px-3">
          <motion.div
            animate={{ opacity: collapsed ? 0 : 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.15 }}
            className={cn('flex items-center gap-2 overflow-hidden', collapsed && 'pointer-events-none')}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg">
              <Smartphone className="h-4 w-4" />
            </div>
            <span className="truncate text-sm font-semibold tracking-tight">CloudPhone</span>
          </motion.div>
          <IconButton
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={toggle}
            size="sm"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </IconButton>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          <SidebarSection label="Main" collapsed={collapsed}>
            <SidebarNavItem icon={LayoutDashboard} label="Dashboard" to="/dashboard" collapsed={collapsed} preloadId="dashboard" />
            <SidebarNavItem icon={Smartphone} label="Phones" to="/phones" collapsed={collapsed} preloadId="phones" />
            <SidebarNavItem icon={Camera} label="Snapshots" to="/snapshots" collapsed={collapsed} preloadId="snapshots" />
            <SidebarNavItem icon={Package} label="APK Library" to="/apk-library" collapsed={collapsed} preloadId="apk-library" />
          </SidebarSection>

          <SidebarSection label="Configure" collapsed={collapsed}>
            <SidebarNavItem icon={Network} label="Network / Proxy" to="/network" collapsed={collapsed} preloadId="network" />
            <SidebarNavItem icon={Fingerprint} label="Fingerprints" to="/fingerprints" collapsed={collapsed} preloadId="fingerprints" />
            <SidebarNavItem icon={Workflow} label="Automation" to="/automation" collapsed={collapsed} preloadId="automation" />
          </SidebarSection>

          <SidebarSection label="System" collapsed={collapsed}>
            <SidebarNavItem icon={ScrollText} label="Logs" to="/logs" collapsed={collapsed} preloadId="logs" />
            <SidebarNavItem icon={SettingsIcon} label="Settings" to="/settings" collapsed={collapsed} preloadId="settings" />
          </SidebarSection>
        </nav>

        <div className="border-t border-border p-3">
          <div className={cn('mb-2', collapsed && 'flex justify-center')}>
            <BackendStateDot state={backendState} showLabel={!collapsed} />
          </div>
          <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-elev-2 text-fg-muted">
              <CircleUser className="h-4 w-4" />
            </div>
            {!collapsed && <span className="truncate text-xs text-fg-muted">Local user</span>}
          </div>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

function SidebarSection({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-2">
      {!collapsed && (
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
          {label}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
