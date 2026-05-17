import { useParams } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function PhoneDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-6">
      <PageHeader title={id ?? 'Phone'} subtitle="Phone details and controls." />
      <EmptyState
        icon={Smartphone}
        title="Detail view coming soon"
        description="Overview, snapshots, apps, network, fingerprint, and logs tabs land here."
      />
    </div>
  );
}
