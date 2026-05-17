import { Workflow } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

export default function Automation() {
  return (
    <div className="p-6">
      <PageHeader
        title="Automation"
        subtitle="Tasks, schedulers, and scripts — coming in a later phase."
        actions={<Badge variant="info">Preview</Badge>}
      />
      <EmptyState icon={Workflow} title="Automation coming soon" description="The runtime is planned for Phase 6." />
    </div>
  );
}
