import { ScrollText } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Logs() {
  return (
    <div className="p-6">
      <PageHeader title="Logs" subtitle="System and backend logs." />
      <EmptyState icon={ScrollText} title="No log streams" description="Backend logs will stream here when the sidecar is running." />
    </div>
  );
}
