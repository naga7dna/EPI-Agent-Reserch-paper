"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

/**
 * Top-level providers. Mounted once in `src/app/layout.tsx`.
 *
 * - TanStack Query: stable client w/ 60s stale time so repeated
 *   searches / collection fetches feel instant.
 * - next-themes: light/dark/system theme switching with persistence.
 * - Sonner Toaster: import { toast } from "sonner" anywhere.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <SonnerToaster position="top-right" richColors closeButton />
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
