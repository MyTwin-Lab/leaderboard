'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Shared client-side query cache. staleTime > 0 means data fetched once (e.g.
// navigating into a challenge) is reused on remount/re-render instead of being
// re-fetched — this is what kills the "9 fetches on every page open" pattern
// and the duplicate fetch React StrictMode causes in dev.
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
