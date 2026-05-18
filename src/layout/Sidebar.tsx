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
import { getCpSafe } from '@/ipc';
import { Kbd } from '@/components/ui/Kbd';
import { useUiStore } from '@/store/ui';
import { useShortcut } from '@/hooks/useShortcut';
import { useReducedMotionSafe } from '@/hooks/useReducedMotionSafe';
import { useBackendState } from '@/hooks/useBackendState';
import { useEffect } from 'react';
import { SidebarNavItem } from './SidebarNavItem';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
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
      if (window.innerWidth < 700 && !collapsed) setCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.aside
      animate={{ width: collapsed ? W_COLLAPSED : W_EXPANDED }}
      transition={reduced ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
      className="flex h-full shrink-0 flex-col border-r border-border bg-bg-elev"
      aria-label="Primary"
    >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-strong text-accent-fg shadow-sm">
              <Smartphone className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </div>
            <Tooltip content={<span className="flex items-center gap-1.5">Expand <Kbd>Ctrl B</Kbd></span>} side="right">
              <IconButton aria-label="Expand sidebar" aria-expanded={false} onClick={toggle} size="sm">
                <PanelLeft className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          </div>
        ) : (
          <div className="flex h-14 items-center justify-between gap-2 px-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-strong text-accent-fg shadow-sm">
                <Smartphone className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-semibold tracking-tight text-fg">CloudPhone</span>
                <span className="truncate text-[10px] text-fg-subtle">v{getCpSafe()?.app.version ?? '0.1.0'}</span>
              </div>
            </div>
            <Tooltip content={<span className="flex items-center gap-1.5">Collapse <Kbd>Ctrl B</Kbd></span>} side="bottom">
              <IconButton aria-label="Collapse sidebar" aria-expanded={true} onClick={toggle} size="sm">
                <PanelLeftClose className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          </div>
        )}

        <nav
          className={cn('sidebar-nav flex-1 overflow-y-auto pb-2', collapsed ? 'px-0' : 'px-2')}
        >
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
    <div className="mt-5 first:mt-3">
      {collapsed ? (
        <div className="mb-1.5 mx-2 h-px bg-border" />
      ) : (
        <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
          {label}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
