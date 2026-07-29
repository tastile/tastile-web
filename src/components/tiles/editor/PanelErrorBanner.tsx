"use client";

import { CloseButton } from "@mantine/core";

interface Props {
  title: string;
  body: string;
  onDismiss?: () => void;
}

export function PanelErrorBanner({ title, body, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-[var(--color-danger,#dc2626)]/30 bg-[var(--color-danger,#dc2626)]/5 p-3"
    >
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[var(--foreground-muted)]">{body}</p>
      </div>
      {onDismiss ? <CloseButton onClick={onDismiss} aria-label="Dismiss error" /> : null}
    </div>
  );
}
