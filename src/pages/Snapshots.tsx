import { Camera } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Snapshots() {
  return (
    <div className="p-6">
      <PageHeader title="Snapshots" subtitle="Global snapshots across all phones." />
      <EmptyState icon={Camera} title="No snapshots yet" description="Snapshots will appear once you create them from any phone." />
    </div>
  );
}
