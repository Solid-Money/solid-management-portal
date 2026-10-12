'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from './auth-provider';
import { Toaster } from 'sonner';

/** A 4xx is the backend's answer, not a blip: asking again only repeats the toast. */
const isClientError = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Every attempt goes through the API interceptor's toast, so the
            // default three retries showed one failure up to four times.
            retry: (failureCount, error) =>
              !isClientError(error) && failureCount < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster position="bottom-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
