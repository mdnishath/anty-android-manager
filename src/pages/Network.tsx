import { Network as NetIcon } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Network() {
  return (
    <div className="p-6">
      <PageHeader title="Network / Proxy" subtitle="Manage proxy groups and routing." />
      <EmptyState icon={NetIcon} title="No proxy groups yet" description="Group your proxies and assign them to phones in bulk." />
    </div>
  );
}
