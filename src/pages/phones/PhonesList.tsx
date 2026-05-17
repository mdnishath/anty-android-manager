import { Smartphone, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function PhonesList() {
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <PageHeader
        title="Phones"
        subtitle="Manage your virtual Android fleet."
        actions={
          <Button onClick={() => navigate('/phones/new')}>
            <Plus className="h-4 w-4" /> New Phone
          </Button>
        }
      />
      <EmptyState
        icon={Smartphone}
        title="No phones yet"
        description="Create your first virtual Android phone to get started."
        action={
          <Button onClick={() => navigate('/phones/new')}>
            <Plus className="h-4 w-4" /> New Phone
          </Button>
        }
      />
    </div>
  );
}
