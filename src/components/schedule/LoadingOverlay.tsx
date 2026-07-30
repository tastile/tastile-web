// src/components/schedule/LoadingOverlay.tsx
"use client";

import type { ReactNode } from "react";

export function LoadingOverlay({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative h-full">
      {children}
      {loading ? (
        <div
          data-testid="day-loading"
          className="pointer-events-none absolute inset-0 flex items-start justify-center bg-surface-0/40 pt-4 text-[10px] uppercase tracking-wider text-foreground-subtle"
        >
          Loading…
        </div>
      ) : null}
    </div>
  );
}
