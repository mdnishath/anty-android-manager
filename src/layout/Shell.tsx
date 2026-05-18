import { Outlet } from 'react-router-dom';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { RouteProgressBar } from '@/components/RouteProgressBar';

export function Shell() {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-fg">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="relative min-h-0 flex-1 overflow-auto">
              <RouteProgressBar />
              <Outlet />
            </main>
          </div>
        </div>
        <StatusBar />
      </div>
    </TooltipProvider>
  );
}
