import { Fingerprint } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Fingerprints() {
  return (
    <div className="p-6">
      <PageHeader title="Fingerprints" subtitle="Saved device fingerprint presets." />
      <EmptyState icon={Fingerprint} title="No presets yet" description="Build presets to apply consistent device identity across phones." />
    </div>
  );
}
