import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Smartphone,
  Play,
  Square,
  Cpu,
  MemoryStick,
  HardDrive,
  Server,
  Plus,
  Package,
  Camera,
  ScrollText,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { usePhonesStore, type PhoneInstance } from '@/store/phones';
import { useBackendState } from '@/hooks/useBackendState';
import { fetchHealth, getSidecarUrl, type HealthResponse } from '@/api/sidecar';
import type { SidecarState } from '@shared/ipc-schemas';

export default function Dashboard() {
  const navigate = useNavigate();
  const phones = usePhonesStore((s) => s.phones);
  const backendState = useBackendState();

  const stats = useMemo(() => deriveStats(phones), [phones]);
  const health = useHealth(backendState);

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        subtitle="At-a-glance system health."
        actions={
          <Button onClick={() => navigate('/phones/new')}>
            <Plus className="h-4 w-4" /> New Phone
          </Button>
        }
      />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Smartphone}
          label="Total phones"
          value={stats.total}
          accent="accent"
          hint={stats.total === 0 ? 'No phones yet' : `${stats.brandCount} brand${stats.brandCount === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={Play}
          label="Running"
          value={stats.running}
          accent="success"
          hint={stats.total > 0 ? `${Math.round((stats.running / stats.total) * 100)}% of fleet` : '—'}
        />
        <StatCard
          icon={Square}
          label="Stopped"
          value={stats.stopped}
          accent="muted"
          hint={stats.total > 0 ? `${stats.total - stats.running} idle` : '—'}
        />
        <BackendCard state={backendState} health={health} />
      </div>

      {/* ── Capacity ── */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CapacityCard
          icon={MemoryStick}
          label="RAM allocated"
          value={`${stats.totalRamGb} GB`}
          breakdown={`${stats.runningRamGb} GB in use`}
          percent={stats.totalRamGb > 0 ? Math.round((stats.runningRamGb / stats.totalRamGb) * 100) : 0}
        />
        <CapacityCard
          icon={HardDrive}
          label="Storage allocated"
          value={formatStorage(stats.totalStorageGb)}
          breakdown={`across ${stats.total} device${stats.total === 1 ? '' : 's'}`}
          percent={0}
        />
        <CapacityCard
          icon={Cpu}
          label="vCPU footprint"
          value={`${stats.totalCores} cores`}
          breakdown={`${stats.runningCores} active`}
          percent={stats.totalCores > 0 ? Math.round((stats.runningCores / stats.totalCores) * 100) : 0}
        />
      </div>

      {/* ── Recent + Brand breakdown ── */}
      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentPhonesPanel phones={stats.recent} />
        </div>
        <BrandBreakdownPanel data={stats.byBrand} total={stats.total} />
      </div>

      {/* ── Quick actions ── */}
      <div className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <QuickAction
            icon={Plus}
            label="New Phone"
            description="Start the wizard"
            onClick={() => navigate('/phones/new')}
          />
          <QuickAction
            icon={Camera}
            label="Snapshots"
            description="Manage saved states"
            onClick={() => navigate('/snapshots')}
          />
          <QuickAction
            icon={Package}
            label="APK Library"
            description="Install apps in bulk"
            onClick={() => navigate('/apk-library')}
          />
          <QuickAction
            icon={ScrollText}
            label="Logs"
            description="Inspect recent activity"
            onClick={() => navigate('/logs')}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Stats helpers ───────────────────────

interface DerivedStats {
  total: number;
  running: number;
  stopped: number;
  totalRamGb: number;
  runningRamGb: number;
  totalStorageGb: number;
  totalCores: number;
  runningCores: number;
  brandCount: number;
  byBrand: { brand: string; color: string; count: number }[];
  recent: PhoneInstance[];
}

function deriveStats(phones: PhoneInstance[]): DerivedStats {
  const running = phones.filter((p) => p.status === 'running');
  const stopped = phones.filter((p) => p.status === 'stopped');
  const totalRamGb = phones.reduce((s, p) => s + p.ramGb, 0);
  const runningRamGb = running.reduce((s, p) => s + p.ramGb, 0);
  const totalStorageGb = phones.reduce((s, p) => s + p.storageGb, 0);
  const totalCores = phones.reduce((s, p) => s + p.templateSnapshot.cpu.cores, 0);
  const runningCores = running.reduce((s, p) => s + p.templateSnapshot.cpu.cores, 0);

  const brandMap = new Map<string, { brand: string; color: string; count: number }>();
  for (const p of phones) {
    const b = p.templateSnapshot.brand;
    const existing = brandMap.get(b);
    if (existing) existing.count++;
    else brandMap.set(b, { brand: b, color: p.templateSnapshot.brandColor, count: 1 });
  }
  const byBrand = Array.from(brandMap.values()).sort((a, b) => b.count - a.count);

  const recent = [...phones].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  return {
    total: phones.length,
    running: running.length,
    stopped: stopped.length,
    totalRamGb,
    runningRamGb,
    totalStorageGb,
    totalCores,
    runningCores,
    brandCount: brandMap.size,
    byBrand,
    recent,
  };
}

function formatStorage(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(gb % 1024 === 0 ? 0 : 1)} TB`;
  return `${gb} GB`;
}

// ─────────────────────── Cards ───────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  hint,
}: {
  icon: typeof Smartphone;
  label: string;
  value: number | string;
  accent: 'accent' | 'success' | 'muted' | 'warning' | 'danger';
  hint?: string;
}) {
  const accentMap = {
    accent: 'bg-accent/15 text-accent',
    success: 'bg-success-bg text-success',
    muted: 'bg-bg-elev-2 text-fg-subtle',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
  } as const;
  return (
    <div className="rounded-lg border border-border bg-bg-elev p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-fg-muted">{label}</span>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', accentMap[accent])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-fg">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-fg-subtle">{hint}</div>}
    </div>
  );
}

function useHealth(state: SidecarState): HealthResponse | null {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  useEffect(() => {
    if (state !== 'ready') {
      setHealth(null);
      return;
    }
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal)
      .then(setHealth)
      .catch(() => setHealth(null));
    return () => ctrl.abort();
  }, [state]);
  return health;
}

function useSidecarUrl(state: SidecarState): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (state === 'ready') getSidecarUrl().then(setUrl).catch(() => setUrl(''));
  }, [state]);
  return url;
}

function BackendCard({ state, health }: { state: SidecarState; health: HealthResponse | null }) {
  const map: Record<SidecarState, { label: string; tone: 'success' | 'warning' | 'muted' | 'danger'; pulse?: boolean }> = {
    starting: { label: 'Starting', tone: 'warning', pulse: true },
    ready: { label: 'Ready', tone: 'success' },
    exited: { label: 'Exited', tone: 'muted' },
    error: { label: 'Error', tone: 'danger' },
  };
  const info = map[state];
  const url = useSidecarUrl(state);
  const toneClasses = {
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    muted: 'bg-bg-elev-2 text-fg-subtle',
    danger: 'bg-danger-bg text-danger',
  } as const;
  return (
    <div className="rounded-lg border border-border bg-bg-elev p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-fg-muted">Backend</span>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', toneClasses[info.tone])}>
          <Server className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            info.tone === 'success' && 'bg-success',
            info.tone === 'warning' && 'bg-warning',
            info.tone === 'muted' && 'bg-fg-subtle',
            info.tone === 'danger' && 'bg-danger',
            info.pulse && 'animate-pulse',
          )}
        />
        <span className="text-xl font-semibold text-fg">{info.label}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-fg-subtle">
        {health
          ? `v${health.version} · Py ${health.python}${health.docker_available ? ` · Docker ${health.docker_version}` : ' · Docker missing'}`
          : 'Sidecar process'}
      </div>
      {health && (
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                health.runtime_mode === 'real' && 'bg-success-bg text-success',
                health.runtime_mode === 'simulated' && 'bg-warning-bg text-warning',
                health.runtime_mode === 'unavailable' && 'bg-danger-bg text-danger',
              )}
              title={health.runtime_reason}
            >
              {health.runtime_mode === 'real' ? '● Real containers' : health.runtime_mode === 'simulated' ? '◐ Simulated' : '○ Unavailable'}
            </span>
          </div>
          {url && (
            <div className="text-[10px] text-fg-muted truncate" title={url}>
              {url.replace(/^https?:\/\//, '')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CapacityCard({
  icon: Icon,
  label,
  value,
  breakdown,
  percent,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  breakdown: string;
  percent: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-elev p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
        <Icon className="h-3.5 w-3.5 text-fg-subtle" />
        {label}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-xl font-semibold tabular-nums text-fg">{value}</span>
        <span className="text-[11px] text-fg-muted">{breakdown}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-elev-2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${Math.max(2, percent)}%`, opacity: percent === 0 ? 0.2 : 1 }}
        />
      </div>
    </div>
  );
}

// ─────────────────────── Recent phones ───────────────────────

function RecentPhonesPanel({ phones }: { phones: PhoneInstance[] }) {
  const navigate = useNavigate();
  if (phones.length === 0) {
    return (
      <Panel title="Recent phones" icon={Activity}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Smartphone className="mb-2 h-8 w-8 text-fg-subtle" />
          <p className="text-sm text-fg-muted">No phones created yet</p>
          <Button size="sm" className="mt-3" onClick={() => navigate('/phones/new')}>
            <Plus className="h-3.5 w-3.5" /> Create your first phone
          </Button>
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      title="Recent phones"
      icon={Activity}
      action={
        <button
          type="button"
          onClick={() => navigate('/phones')}
          className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
        >
          View all <ArrowRight className="h-3 w-3" />
        </button>
      }
    >
      <ul className="divide-y divide-border/60">
        {phones.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <div
              className="h-9 w-9 shrink-0 rounded-md"
              style={{
                background: `linear-gradient(135deg, ${p.templateSnapshot.brandColor} 0%, ${p.templateSnapshot.brandColor}90 100%)`,
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-fg">{p.name}</span>
                <PhoneStatusDot status={p.status} />
              </div>
              <div className="truncate text-[11px] text-fg-muted">
                {p.templateSnapshot.brand} {p.templateSnapshot.model} · {p.ramGb}/{p.storageGb} GB
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-fg-subtle">
              {formatDistanceToNow(p.createdAt, { addSuffix: true })}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function PhoneStatusDot({ status }: { status: PhoneInstance['status'] }) {
  const map = {
    stopped: { tone: 'bg-fg-subtle', label: 'stopped' },
    starting: { tone: 'bg-warning animate-pulse', label: 'starting' },
    running: { tone: 'bg-success', label: 'running' },
    error: { tone: 'bg-danger', label: 'error' },
  } as const;
  const info = map[status];
  return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', info.tone)} title={info.label} />;
}

// ─────────────────────── Brand breakdown ───────────────────────

function BrandBreakdownPanel({
  data,
  total,
}: {
  data: { brand: string; color: string; count: number }[];
  total: number;
}) {
  return (
    <Panel title="By brand" icon={Smartphone}>
      {data.length === 0 ? (
        <div className="py-6 text-center text-sm text-fg-subtle">No data yet</div>
      ) : (
        <ul className="space-y-3">
          {data.map((b) => {
            const pct = Math.round((b.count / total) * 100);
            return (
              <li key={b.brand}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-fg">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: b.color }}
                    />
                    {b.brand}
                  </span>
                  <span className="tabular-nums text-fg-muted">
                    {b.count} <span className="text-fg-subtle">· {pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-elev-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: b.color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ─────────────────────── Generic panel ───────────────────────

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof Cpu;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full rounded-lg border border-border bg-bg-elev p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          <Icon className="h-3.5 w-3.5 text-fg-subtle" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────── Quick actions ───────────────────────

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: typeof Smartphone;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-lg border border-border bg-bg-elev p-3 text-left transition-colors hover:border-border-strong hover:bg-bg-elev-2/60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent transition-colors group-hover:bg-accent/25">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-fg">{label}</div>
        <div className="truncate text-[11px] text-fg-muted">{description}</div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
