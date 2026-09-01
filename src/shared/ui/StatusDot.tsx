"use client";

import { cn } from "@/shared/lib/cn";

type StatusKind =
  | "active"
  | "started"
  | "ready"
  | "done"
  | "deferred"
  | "warn"
  | "danger"
  | "pending"
  | "neutral";

const statusClass: Record<
  StatusKind,
  { dot: string; ring: string; text: string }
> = {
  active: {
    dot: "bg-status-active",
    ring: "ring-status-active/30",
    text: "text-status-active",
  },
  started: {
    dot: "bg-status-active",
    ring: "ring-status-active/30",
    text: "text-status-active",
  },
  ready: {
    dot: "bg-status-pending",
    ring: "ring-status-pending/30",
    text: "text-status-pending",
  },
  done: {
    dot: "bg-status-done",
    ring: "ring-status-done/30",
    text: "text-status-done",
  },
  deferred: {
    dot: "bg-status-warn",
    ring: "ring-status-warn/30",
    text: "text-status-warn",
  },
  warn: {
    dot: "bg-status-warn",
    ring: "ring-status-warn/30",
    text: "text-status-warn",
  },
  danger: {
    dot: "bg-status-danger",
    ring: "ring-status-danger/30",
    text: "text-status-danger",
  },
  pending: {
    dot: "bg-status-pending",
    ring: "ring-status-pending/30",
    text: "text-status-pending",
  },
  neutral: { dot: "bg-ink-4", ring: "ring-ink-4/20", text: "text-ink-3" },
};

interface StatusDotProps {
  status: StatusKind;
  size?: "xs" | "sm" | "md";
  pulse?: boolean;
  label?: string;
  className?: string;
}

export function StatusDot({
  status,
  size = "sm",
  pulse,
  label,
  className,
}: StatusDotProps) {
  const cls = statusClass[status];
  const dim =
    size === "xs" ? "size-1.5" : size === "md" ? "size-2.5" : "size-2";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-block rounded-full ring-4",
          dim,
          cls.dot,
          cls.ring,
          pulse && (status === "active" || status === "started")
            ? "motion-safe:animate-pulse"
            : null,
        )}
        aria-hidden="true"
      />
      {label ? (
        <span className={cn("text-xs font-medium tabular-nums", cls.text)}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
