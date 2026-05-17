import { Info } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { getCpSafe } from '@/ipc';

export default function About() {
  const cp = getCpSafe();
  const info = cp?.app;
  return (
    <div className="p-6">
      <PageHeader title="About" subtitle="Version and environment information." />
      <Card className="max-w-xl">
        <CardContent className="space-y-2 p-6 text-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-fg">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold">CloudPhone Manager</div>
              <div className="text-xs text-fg-muted">Local virtual Android fleet manager</div>
            </div>
          </div>
          <Row label="Version" value={info?.version ?? '—'} />
          <Row label="Commit" value={info?.commit ?? '—'} />
          <Row label="Platform" value={info?.platform ?? '—'} />
          <Row label="Electron" value={info?.electron ?? '—'} />
          <Row label="Chromium" value={info?.chrome ?? '—'} />
          <Row label="Node" value={info?.node ?? '—'} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 last:border-0">
      <span className="text-fg-muted">{label}</span>
      <span className="font-mono text-xs text-fg">{value}</span>
    </div>
  );
}
