import { QueryClient } from '@tanstack/react-query';

type ApiError = { code?: string; message?: string };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const code = (error as ApiError | undefined)?.code;
        if (code === 'NOT_FOUND') return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
