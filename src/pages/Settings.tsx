import { Settings as SettingsIcon } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Settings() {
  return (
    <div className="p-6">
      <PageHeader title="Settings" subtitle="App preferences, backend, and storage." />
      <EmptyState icon={SettingsIcon} title="Settings coming soon" description="General, Appearance, Backend, Docker, Storage, Shortcuts, Advanced tabs land here." />
    </div>
  );
}
