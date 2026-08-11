"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * Dashboard-scoped QueryClient provider.
 *
 * One `QueryClient` is created per mounted dashboard tree, so the
 * cache is shared by every component under the dashboard layout but
 * not pollute global state. Defaults are conservative: refetch on
 * window focus is disabled (the active-tile hook polls on its own
 * 5-second timer) and stale time is zero so consumers always read
 * fresh data when the cache is hit.
 */
export function DashboardQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: 0,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}