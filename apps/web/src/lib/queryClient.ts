import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Don't retry 4xx — they're intentional
        if (error instanceof Error && error.message.startsWith('HTTP 4')) return false;
        return failureCount < 1;
      },
    },
  },
});
