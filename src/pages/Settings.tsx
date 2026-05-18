import { useEffect, useState } from 'react';
import { Server, RefreshCw, ShieldCheck, ShieldAlert, Loader2, Globe2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { useSettingsStore } from '@/store/settings';
import { useBackendState } from '@/hooks/useBackendState';
import { getCpSafe } from '@/ipc';
import {
  fetchHealth,
  resetSidecarConnection,
  SidecarError,
  type HealthResponse,
} from '@/api/sidecar';

export default function Settings() {
  return (
    <div className="p-6">
      <PageHeader
        title="Settings"
        subtitle="App preferences, backend connection and storage."
      />
      <div className="mx-auto max-w-3xl space-y-6">
        <BackendSection />
      </div>
    </div>
  );
}

function BackendSection() {
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.set);
  const backendState = useBackendState();

  // Local form state so the user can edit without restarting on every keystroke.
  const [remoteUrl, setRemoteUrl] = useState(settings.sidecarRemoteUrl);
  const [remoteToken, setRemoteToken] = useState(settings.sidecarRemoteToken);
  const [testing, setTesting] = useState(false);
  const [lastHealth, setLastHealth] = useState<HealthResponse | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    setRemoteUrl(settings.sidecarRemoteUrl);
    setRemoteToken(settings.sidecarRemoteToken);
  }, [settings.sidecarRemoteUrl, settings.sidecarRemoteToken]);

  // Load current backend health when it's ready.
  useEffect(() => {
    if (backendState !== 'ready') {
      setLastHealth(null);
      return;
    }
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal)
      .then(setLastHealth)
      .catch(() => setLastHealth(null));
    return () => ctrl.abort();
  }, [backendState]);

  const dirty =
    remoteUrl.trim() !== settings.sidecarRemoteUrl ||
    remoteToken.trim() !== settings.sidecarRemoteToken;

  const isRemoteSet = !!settings.sidecarRemoteUrl;

  const onTest = async () => {
    setTesting(true);
    try {
      const url = remoteUrl.trim().replace(/\/+$/, '');
      if (!url) {
        toast.error('Enter a URL first');
        return;
      }
      const res = await fetch(`${url}/health`);
      if (!res.ok) {
        toast.error(`Health check failed: HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as HealthResponse;
      toast.success('Connected', {
        description: `${body.platform} · Docker ${body.docker_version} · ${body.runtime_mode}`,
      });
    } catch (err) {
      toast.error('Cannot reach sidecar', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    try {
      await setSetting('sidecarRemoteUrl', remoteUrl.trim());
      await setSetting('sidecarRemoteToken', remoteToken.trim());
      resetSidecarConnection();
      toast.success('Saved', {
        description: 'Restart the backend to apply changes.',
      });
    } catch (err) {
      toast.error('Save failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onClear = async () => {
    setRemoteUrl('');
    setRemoteToken('');
    await setSetting('sidecarRemoteUrl', '');
    await setSetting('sidecarRemoteToken', '');
    resetSidecarConnection();
    toast.success('Switched back to local sidecar', {
      description: 'Restart the backend to apply.',
    });
  };

  const onRestart = async () => {
    const cp = getCpSafe();
    if (!cp) return;
    try {
      await cp.restartSidecar();
      resetSidecarConnection();
      toast.success('Backend restart requested');
    } catch (err) {
      toast.error('Restart failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <Section title="Backend" icon={Server}>
      {/* Status card */}
      <div className="mb-5 rounded-lg border border-border bg-bg-elev-2/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusDot state={backendState} />
              <span className="text-sm font-medium text-fg">
                {backendState === 'ready' ? 'Connected' : backendState}
              </span>
              <Badge variant={isRemoteSet ? 'accent' : 'muted'} size="sm">
                {isRemoteSet ? 'Remote' : 'Local'}
              </Badge>
              {lastHealth && (
                <Badge
                  size="sm"
                  variant={
                    lastHealth.runtime_mode === 'real'
                      ? 'success'
                      : lastHealth.runtime_mode === 'simulated'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {lastHealth.runtime_mode === 'real'
                    ? '● Real containers'
                    : lastHealth.runtime_mode === 'simulated'
                      ? '◐ Simulated'
                      : '○ Unavailable'}
                </Badge>
              )}
            </div>
            {lastHealth && (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-fg-muted">
                <span>App: v{lastHealth.version}</span>
                <span>Python: {lastHealth.python}</span>
                <span>Platform: {lastHealth.platform}</span>
                <span>
                  Docker: {lastHealth.docker_available ? lastHealth.docker_version : 'missing'}
                </span>
                <span className="col-span-2">
                  Binder: {lastHealth.binder_available ? 'yes' : 'no'} · {lastHealth.runtime_reason}
                </span>
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onRestart}>
            <RefreshCw className="h-3.5 w-3.5" /> Restart
          </Button>
        </div>
      </div>

      {/* Remote sidecar form */}
      <div className="space-y-4">
        <p className="text-xs text-fg-muted">
          By default the app spawns a local Python sidecar. Point this at a remote
          sidecar (VPS, lab machine) to run real redroid containers without needing
          a binder-capable kernel on this Windows host.
        </p>

        <Field
          label="Remote sidecar URL"
          hint={isRemoteSet ? 'Set — local sidecar is skipped' : 'Empty — use local sidecar'}
        >
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 shrink-0 text-fg-subtle" />
            <input
              type="text"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="http://144.79.218.148:38080"
              className="h-9 flex-1 rounded-md border border-border bg-bg-elev px-3 font-mono text-[12px] text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
        </Field>

        <Field label="Sidecar token" hint="Required X-CP-Token header">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-fg-subtle" />
            <input
              type={showToken ? 'text' : 'password'}
              value={remoteToken}
              onChange={(e) => setRemoteToken(e.target.value)}
              placeholder="32+ random hex chars"
              className="h-9 flex-1 rounded-md border border-border bg-bg-elev px-3 font-mono text-[12px] text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={() => setShowToken((s) => !s)}
              className="text-xs text-fg-muted hover:text-fg"
            >
              {showToken ? 'hide' : 'show'}
            </button>
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onTest} disabled={testing}>
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5" />
            )}
            Test connection
          </Button>
          <Button size="sm" onClick={onSave} disabled={!dirty}>
            Save
          </Button>
          {isRemoteSet && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Use local
            </Button>
          )}
          <span className="ml-auto text-[11px] text-fg-subtle">
            Save then click Restart for changes to apply.
          </span>
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────── Tiny primitives ───────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Server;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-bg-elev p-5">
      <header className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-fg-subtle" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-fg">{label}</label>
        {hint && <span className="text-[11px] text-fg-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function StatusDot({ state }: { state: ReturnType<typeof useBackendState> }) {
  const cls = {
    starting: 'bg-warning animate-pulse',
    ready: 'bg-success',
    exited: 'bg-fg-subtle',
    error: 'bg-danger',
  } as const;
  return <span className={cn('h-2 w-2 rounded-full', cls[state])} />;
}

// Mark unused imports quiet — kept for future error toasts
void SidecarError;
