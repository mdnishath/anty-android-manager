import { Suspense, lazy, type ComponentType } from 'react';
import { createMemoryRouter, Navigate, Outlet } from 'react-router-dom';
import { RouteErrorBoundary } from '@/error/RouteErrorBoundary';
import { PageSkeleton } from '@/components/Skeleton';
import { Shell } from '@/layout/Shell';
import { registerPreload } from './preload';

function lazyRoute(id: string, loader: () => Promise<{ default: ComponentType }>) {
  registerPreload(id, loader);
  return lazy(loader);
}

const Dashboard = lazyRoute('dashboard', () => import('@/pages/Dashboard'));
const PhonesList = lazyRoute('phones', () => import('@/pages/phones/PhonesList'));
const CreatePhone = lazyRoute('phones-new', () => import('@/pages/phones/CreatePhone'));
const PhoneDetail = lazyRoute('phone-detail', () => import('@/pages/phones/PhoneDetail'));
const Snapshots = lazyRoute('snapshots', () => import('@/pages/Snapshots'));
const ApkLibrary = lazyRoute('apk-library', () => import('@/pages/ApkLibrary'));
const Network = lazyRoute('network', () => import('@/pages/Network'));
const Fingerprints = lazyRoute('fingerprints', () => import('@/pages/Fingerprints'));
const Automation = lazyRoute('automation', () => import('@/pages/Automation'));
const Logs = lazyRoute('logs', () => import('@/pages/Logs'));
const Settings = lazyRoute('settings', () => import('@/pages/Settings'));
const About = lazyRoute('about', () => import('@/pages/About'));
const NotFound = lazyRoute('not-found', () => import('@/pages/NotFound'));

function RouteShell() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </RouteErrorBoundary>
  );
}

export const router = createMemoryRouter(
  [
    {
      path: '/',
      element: <Shell />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        {
          element: <RouteShell />,
          children: [
            { path: 'dashboard', element: <Dashboard /> },
            { path: 'phones', element: <PhonesList /> },
            { path: 'phones/new', element: <CreatePhone /> },
            { path: 'phones/:id/*', element: <PhoneDetail /> },
            { path: 'snapshots', element: <Snapshots /> },
            { path: 'apk-library', element: <ApkLibrary /> },
            { path: 'network', element: <Network /> },
            { path: 'fingerprints', element: <Fingerprints /> },
            { path: 'automation', element: <Automation /> },
            { path: 'logs', element: <Logs /> },
            { path: 'settings', element: <Settings /> },
            { path: 'about', element: <About /> },
            { path: '*', element: <NotFound /> },
          ],
        },
      ],
    },
  ],
  { initialEntries: ['/dashboard'] },
);
