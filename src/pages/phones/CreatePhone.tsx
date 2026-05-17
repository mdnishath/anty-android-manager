import { Wand2 } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CreatePhone() {
  return (
    <div className="p-6">
      <PageHeader title="New Phone" subtitle="A 5-step wizard for creating a new virtual Android device." />
      <EmptyState
        icon={Wand2}
        title="Wizard coming soon"
        description="Basics, image, hardware, identity, network — built in a later step."
      />
    </div>
  );
}
