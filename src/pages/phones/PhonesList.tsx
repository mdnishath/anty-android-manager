import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Smartphone,
  Plus,
  Search,
  Play,
  Square,
  MoreVertical,
  Trash2,
  Pencil,
  Terminal,
  MonitorPlay,
  Cpu,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { cn } from '@/lib/cn';
import { usePhonesStore, type PhoneInstance } from '@/store/phones';
import {
  upsertPhone,
  startPhone as startPhoneApi,
  stopPhone as stopPhoneApi,
  deletePhone as deletePhoneApi,
  getPhoneConnection,
  getSidecarUrl,
  SidecarError,
} from '@/api/sidecar';
import { getCpSafe } from '@/ipc';
import { useBackendState } from '@/hooks/useBackendState';
import type { PhoneTemplate } from '@/data/phoneTemplates';

export default function PhonesList() {
  const navigate = useNavigate();
  const phones = usePhonesStore((s) => s.phones);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return phones;
    return phones.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.templateSnapshot.brand.toLowerCase().includes(q) ||
        p.templateSnapshot.model.toLowerCase().includes(q),
    );
  }, [phones, query]);

  if (phones.length === 0) {
    return (
      <div className="p-6">
        <PageHeader
          title="Phones"
          subtitle="Manage your virtual Android fleet."
          actions={
            <Button onClick={() => navigate('/phones/new')}>
              <Plus className="h-4 w-4" /> New Phone
            </Button>
          }
        />
        <EmptyState
          icon={Smartphone}
          title="No phones yet"
          description="Create your first virtual Android phone to get started."
          action={
            <Button onClick={() => navigate('/phones/new')}>
              <Plus className="h-4 w-4" /> New Phone
            </Button>
          }
        />
      </div>
    );
  }

  const running = phones.filter((p) => p.status === 'running').length;

  return (
    <div className="p-6">
      <PageHeader
        title="Phones"
        subtitle={
          <>
            {phones.length} virtual device{phones.length === 1 ? '' : 's'}
            {running > 0 && (
              <>
                {' · '}
                <span className="text-success">{running} running</span>
              </>
            )}
          </>
        }
        actions={
          <Button onClick={() => navigate('/phones/new')}>
            <Plus className="h-4 w-4" /> New Phone
          </Button>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            placeholder="Search phones…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-bg-elev pl-9 pr-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <p className="text-sm font-medium text-fg">No phones match your search</p>
          <p className="mt-1 text-xs text-fg-muted">Try a different name or brand.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((phone) => (
            <PhoneCard key={phone.id} phone={phone} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────── PhoneCard ───────────────────────

function PhoneCard({ phone }: { phone: PhoneInstance }) {
  const navigate = useNavigate();
  const setStatus = usePhonesStore((s) => s.setStatus);
  const remove = usePhonesStore((s) => s.remove);
  const backendState = useBackendState();
  const backendReady = backendState === 'ready';

  const t = phone.templateSnapshot;
  const isRunning = phone.status === 'running';
  const isStarting = phone.status === 'starting';
  const isError = phone.status === 'error';

  const onStart = async () => {
    if (!backendReady) {
      toast.error('Backend not ready');
      return;
    }
    setStatus(phone.id, 'starting');
    try {
      await upsertPhone(phone);
      await startPhoneApi(phone.id);
      toast.success(`${phone.name} starting`, {
        description: 'Container booting — this may take 10–30 seconds.',
      });
      // Optimistically flip to running after a short delay; status polling
      // will correct it if the container actually failed.
      setTimeout(() => setStatus(phone.id, 'running'), 3000);
    } catch (err) {
      setStatus(phone.id, 'error');
      const msg = err instanceof SidecarError ? err.message : String(err);
      toast.error(`Failed to start ${phone.name}`, { description: msg });
    }
  };
  const onStop = async () => {
    if (!backendReady) {
      toast.error('Backend not ready');
      return;
    }
    try {
      await stopPhoneApi(phone.id);
      setStatus(phone.id, 'stopped');
      toast(`${phone.name} stopped`);
    } catch (err) {
      const msg = err instanceof SidecarError ? err.message : String(err);
      toast.error(`Failed to stop ${phone.name}`, { description: msg });
    }
  };
  const onDelete = async () => {
    if (!confirm(`Delete ${phone.name}? This cannot be undone.`)) return;
    if (backendReady) {
      try {
        await deletePhoneApi(phone.id);
      } catch {
        /* best-effort — still remove locally */
      }
    }
    remove(phone.id);
    toast.success(`${phone.name} deleted`);
  };
  const onScrcpy = async () => {
    const cp = getCpSafe();
    if (!cp) {
      toast.error('Launcher unavailable (Electron bridge missing)');
      return;
    }
    if (!isRunning) {
      toast.error('Start the phone first');
      return;
    }
    try {
      const conn = await getPhoneConnection(phone.id);
      if (!conn.container_ip) {
        toast.error('Container has no IP yet — wait a few seconds and retry');
        return;
      }
      const sidecarUrl = await getSidecarUrl();
      const t = toast.loading(`Opening scrcpy for ${phone.name}…`);
      const res = await cp.launchScrcpy({
        phoneId: phone.id,
        phoneName: phone.name,
        containerIp: conn.container_ip,
        sidecarUrl,
      });
      toast.dismiss(t);
      if (res.ok) {
        toast.success(`scrcpy launched`, {
          description: `Tunnel on 127.0.0.1:${res.localPort}`,
        });
      } else {
        toast.error('scrcpy failed', { description: res.error });
      }
    } catch (err) {
      toast.error('scrcpy failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };
  const onAdb = async () => {
    const cp = getCpSafe();
    if (!cp) {
      toast.error('Launcher unavailable (Electron bridge missing)');
      return;
    }
    if (!isRunning) {
      toast.error('Start the phone first');
      return;
    }
    try {
      const conn = await getPhoneConnection(phone.id);
      if (!conn.container_ip) {
        toast.error('Container has no IP yet — wait a few seconds and retry');
        return;
      }
      const sidecarUrl = await getSidecarUrl();
      const res = await cp.launchAdbShell({
        phoneId: phone.id,
        phoneName: phone.name,
        containerIp: conn.container_ip,
        sidecarUrl,
      });
      if (res.ok) {
        toast.success('ADB shell opened in a new window');
      } else {
        toast.error('ADB shell failed', { description: res.error });
      }
    } catch (err) {
      toast.error('ADB shell failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-bg-elev transition-colors hover:border-border-strong">
      <DevicePreview template={t} status={phone.status} />

      <div className="flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-fg">{phone.name}</h3>
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              {t.brand} {t.model} · {t.releaseYear}
            </p>
          </div>
          <StatusBadge status={phone.status} />
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-fg-muted">
          <Cpu className="h-3 w-3 shrink-0 text-fg-subtle" />
          <span className="truncate" title={t.soc}>
            {shortenSoc(t.soc)}
          </span>
          <span className="text-fg-subtle">·</span>
          <span>{phone.ramGb} / {phone.storageGb} GB</span>
        </div>
        <p className="mt-1 text-[11px] text-fg-subtle">
          Created {formatDistanceToNow(phone.createdAt, { addSuffix: true })}
        </p>
      </div>

      <div className="flex items-center gap-1.5 border-t border-border bg-bg-elev/50 p-2">
        {isRunning || isStarting ? (
          <Button variant="secondary" size="sm" onClick={onStop} disabled={isStarting} className="flex-1">
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
        ) : (
          <Button size="sm" onClick={onStart} disabled={isError} className="flex-1">
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => navigate(`/phones/${phone.templateId}`)}>
              <Smartphone className="h-4 w-4" /> View template
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onScrcpy} disabled={!isRunning}>
              <MonitorPlay className="h-4 w-4" /> Open scrcpy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAdb} disabled={!isRunning}>
              <Terminal className="h-4 w-4" /> ADB shell
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toast.info('Rename UI coming soon')}>
              <Pencil className="h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem destructive onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─────────────────────── Pieces ───────────────────────

function StatusBadge({ status }: { status: PhoneInstance['status'] }) {
  const map = {
    stopped: { label: 'Stopped', variant: 'muted' as const, dot: 'bg-fg-subtle' },
    starting: { label: 'Starting', variant: 'warning' as const, dot: 'bg-warning animate-pulse' },
    running: { label: 'Running', variant: 'success' as const, dot: 'bg-success' },
    error: { label: 'Error', variant: 'danger' as const, dot: 'bg-danger' },
  } as const;
  const info = map[status];
  return (
    <Badge variant={info.variant} size="sm" className="shrink-0">
      <span className={cn('mr-1 h-1.5 w-1.5 rounded-full', info.dot)} />
      {info.label}
    </Badge>
  );
}

function DevicePreview({
  template,
  status,
}: {
  template: PhoneTemplate;
  status: PhoneInstance['status'];
}) {
  const { widthPx, heightPx } = template.display;
  const aspect = widthPx / heightPx;
  const previewHeight = template.formFactor === 'foldable' ? 110 : 120;
  const previewWidth = Math.round(previewHeight * aspect);

  return (
    <div
      className="relative grid h-36 w-full place-items-center overflow-hidden border-b border-border"
      style={{
        background: `radial-gradient(circle at center, ${template.brandColor}33 0%, ${template.brandColor}0d 55%, transparent 80%), hsl(var(--bg))`,
      }}
    >
      {status === 'starting' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-bg/40 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-fg-muted" />
        </div>
      )}
      <div
        className={cn(
          'relative overflow-hidden rounded-[10px] border-[3px] shadow-lg transition-all',
          status === 'running' && 'ring-2 ring-success/40 ring-offset-2 ring-offset-bg-elev',
          status === 'error' && 'ring-2 ring-danger/40 ring-offset-2 ring-offset-bg-elev',
        )}
        style={{
          width: previewWidth,
          height: previewHeight,
          borderColor: template.brandColor,
          background: `linear-gradient(160deg, ${template.brandColor}cc 0%, ${template.brandColor}66 60%, ${template.brandColor}33 100%)`,
        }}
      >
        <div
          className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: '#00000055' }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center text-white/90">
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">
            {template.brand}
          </span>
          <span className="text-[11px] font-semibold leading-tight">
            {template.model.replace(template.brand, '').trim() || template.model}
          </span>
        </div>
        {template.formFactor === 'foldable' && (
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
        )}
      </div>
    </div>
  );
}

function shortenSoc(soc: string): string {
  return soc
    .replace('Qualcomm ', '')
    .replace('MediaTek ', '')
    .replace('Google ', '')
    .replace('Samsung ', '')
    .replace(' for Galaxy', '');
}
