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
  /** Optional: handler for the "Discard draft" button. Pass `null` to hide it. */
  onDiscardDraft?: (() => void) | null;
  /** Optional: shown next to the discard button when provided. */
  discardLabel?: string;
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
  onDiscardDraft,
  discardLabel,
}: Props) {
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
      {serverError ? <PanelErrorBanner title={serverError.title} body={serverError.body} /> : null}
      <Group justify="space-between" align="center">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          {onDiscardDraft ? (
            <Button
              variant="subtle"
              color="red"
              onClick={onDiscardDraft}
              disabled={isSubmitting}
              data-testid="quick-create-discard-draft"
            >
              {discardLabel ?? "Discard draft"}
            </Button>
          ) : null}
        </div>
        <Button
          onClick={onSubmit}
          loading={isSubmitting}
          disabled={!canSubmit}
          data-testid="quick-create-submit"
        >
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
