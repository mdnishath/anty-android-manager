import { useLocation, useNavigate } from 'react-router-dom';
import { Search, MoreVertical, HelpCircle, Info, RefreshCw, FolderOpen, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Kbd } from '@/components/ui/Kbd';
import { Tooltip } from '@/components/ui/Tooltip';
import { IconButton } from '@/components/ui/IconButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useUiStore } from '@/store/ui';
import { useShortcut } from '@/hooks/useShortcut';
import { getCpSafe } from '@/ipc';

function titleForPath(pathname: string): string {
  const map: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/phones': 'Phones',
    '/phones/new': 'New Phone',
    '/snapshots': 'Snapshots',
    '/apk-library': 'APK Library',
    '/network': 'Network',
    '/fingerprints': 'Fingerprints',
    '/automation': 'Automation',
    '/logs': 'Logs',
    '/settings': 'Settings',
    '/about': 'About',
  };
  if (map[pathname]) return map[pathname]!;
  if (pathname.startsWith('/phones/')) return 'Phone Detail';
  return '';
}

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);

  useShortcut('mod+k', () => setOpen(true));

  const title = titleForPath(location.pathname);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-bg px-4">
      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
          <span className="text-fg-subtle">CloudPhone</span>
          {title && (
            <>
              <span className="text-border-strong">/</span>
              <span className="font-semibold text-fg">{title}</span>
            </>
          )}
        </nav>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 w-56 items-center gap-2 rounded-md border border-border bg-bg-elev px-3 text-sm text-fg-subtle transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:w-64 hover:border-border-strong md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div className="flex items-center gap-1">
        <Tooltip content="Command palette (⌘K)" side="bottom">
          <IconButton aria-label="Command palette" onClick={() => setOpen(true)} className="md:hidden">
            <Search className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label="More">
              <MoreVertical className="h-4 w-4" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate('/about')}>
              <Info className="h-4 w-4" /> About
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void getCpSafe()?.openExternal('https://github.com');
              }}
            >
              <HelpCircle className="h-4 w-4" /> Help & Docs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void getCpSafe()?.restartSidecar();
              }}
            >
              <RefreshCw className="h-4 w-4" /> Restart backend
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void getCpSafe()?.openPath('');
              }}
            >
              <FolderOpen className="h-4 w-4" /> Open logs folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={() => {
                void getCpSafe()?.restartApp();
              }}
            >
              <LogOut className="h-4 w-4" /> Quit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
