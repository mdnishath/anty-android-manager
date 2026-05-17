import { FileQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <PageHeader title="Not Found" />
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you were looking for does not exist."
        action={<Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>}
      />
    </div>
  );
}
