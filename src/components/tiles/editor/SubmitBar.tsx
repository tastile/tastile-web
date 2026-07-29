"use client";

import { Button, Group } from "@mantine/core";
import { PanelErrorBanner } from "./PanelErrorBanner";

interface Props {
  canSubmit: boolean;
  blockedReason: string | null;
  isSubmitting: boolean;
  serverError: { title: string; body: string } | null;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  cancelLabel: string;
}

export function SubmitBar({
  canSubmit,
  blockedReason,
  isSubmitting,
  serverError,
  onClose,
  onSubmit,
  submitLabel,
  cancelLabel,
}: Props) {
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
      {serverError ? <PanelErrorBanner title={serverError.title} body={serverError.body} /> : null}
      <Group justify="space-between" align="center">
        <Button variant="default" onClick={onClose} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
        <Button onClick={onSubmit} loading={isSubmitting} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </Group>
      {blockedReason && !canSubmit ? (
        <p className="text-xs text-[var(--foreground-muted)]" aria-live="polite">
          {blockedReason}
        </p>
      ) : null}
    </div>
  );
}
