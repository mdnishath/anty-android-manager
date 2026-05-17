import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Dashboard() {
  return (
    <div className="p-6">
      <PageHeader title="Dashboard" subtitle="At-a-glance system health." />
      <EmptyState
        icon={LayoutDashboard}
        title="Dashboard coming soon"
        description="Stats, charts, and alerts will appear here once the backend is wired up."
      />
    </div>
  );
}
