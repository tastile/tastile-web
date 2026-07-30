// src/components/schedule/ErrorBanner.tsx
"use client";

import { Alert } from "@mantine/core";
import { AlertCircle } from "lucide-react";

export function ErrorBanner({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-4 top-2 z-20 flex justify-center"
      data-testid="cal-error-wrap"
    >
      <Alert
        variant="light"
        color="red"
        icon={<AlertCircle className="h-4 w-4" />}
        title={`Couldn't load events: ${error.message}`}
        data-testid="cal-error"
        className="pointer-events-auto w-full max-w-2xl"
      />
    </div>
  );
}
