// src/components/schedule/ErrorBanner.tsx
"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { Alert } from "@mantine/core";
import { AlertCircle } from "lucide-react";

export function ErrorBanner({ error }: { error: Error | null }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-4 top-2 z-20 flex justify-center"
      data-testid="cal-error-wrap"
    >
      <Alert
        role="alert"
        variant="light"
        color="red"
        icon={<AlertCircle className="size-4" />}
        title={t("schedule.error.loadFailed", { message: error.message })}
        data-testid="cal-error"
        className="pointer-events-auto w-full max-w-2xl"
      />
    </div>
  );
}
