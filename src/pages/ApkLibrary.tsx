import { Package } from 'lucide-react';
import { PageHeader } from '@/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ApkLibrary() {
  return (
    <div className="p-6">
      <PageHeader title="APK Library" subtitle="Reusable APKs to install on any phone." />
      <EmptyState icon={Package} title="No APKs yet" description="Drop APK files here or upload them to build your library." />
    </div>
  );
}
