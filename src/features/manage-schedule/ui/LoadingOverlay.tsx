// src/components/schedule/LoadingOverlay.tsx
"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import type { ReactNode } from "react";

export function LoadingOverlay({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative h-full">
      {children}
      {loading ? (
        <output
          data-testid="day-loading"
          className="pointer-events-none absolute inset-0 flex items-start justify-center bg-surface-0/40 pt-4 text-[10px] uppercase tracking-wider text-foreground-subtle"
        >
          {t("common.loading")}
        </output>
      ) : null}
    </div>
  );
}
