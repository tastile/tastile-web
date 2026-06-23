"use client";

import { cn } from "@/lib/utils/cn";

export type StatusKind =
  | "active"
  | "started"
  | "ready"
  | "done"
  | "deferred"
  | "warn"
  | "danger"
  | "pending"
  | "neutral";

const statusClass: Record<StatusKind, { dot: string; ring: string; text: string }> = {
  active: { dot: "bg-status-active", ring: "ring-status-active/30", text: "text-status-active" },
  started: { dot: "bg-status-active", ring: "ring-status-active/30", text: "text-status-active" },
  ready: { dot: "bg-status-pending", ring: "ring-status-pending/30", text: "text-status-pending" },
  done: { dot: "bg-status-done", ring: "ring-status-done/30", text: "text-status-done" },
  deferred: { dot: "bg-status-warn", ring: "ring-status-warn/30", text: "text-status-warn" },
  warn: { dot: "bg-status-warn", ring: "ring-status-warn/30", text: "text-status-warn" },
  danger: { dot: "bg-status-danger", ring: "ring-status-danger/30", text: "text-status-danger" },
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

export function StatusDot({ status, size = "sm", pulse, label, className }: StatusDotProps) {
  const cls = statusClass[status];
  const dim = size === "xs" ? "h-1.5 w-1.5" : size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-block rounded-full ring-4",
          dim,
          cls.dot,
          cls.ring,
          pulse && (status === "active" || status === "started") ? "animate-pulse" : null,
        )}
        aria-hidden="true"
      />
      {label ? (
        <span className={cn("text-xs font-medium tabular-nums", cls.text)}>{label}</span>
      ) : null}
    </span>
  );
}

interface PillProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "active" | "warn" | "danger" | "done" | "pending";
  size?: "sm" | "md";
  className?: string;
}

const pillVariant: Record<NonNullable<PillProps["variant"]>, string> = {
  default: "bg-surface-2 text-ink-2 border-border",
  accent: "bg-accent-soft text-accent border-accent/30",
  active: "bg-status-active-soft text-status-active border-status-active/30",
  warn: "bg-status-warn-soft text-status-warn border-status-warn/30",
  danger: "bg-status-danger-soft text-status-danger border-status-danger/30",
  done: "bg-status-done-soft text-status-done border-status-done/30",
  pending: "bg-status-pending-soft text-status-pending border-status-pending/30",
};

export function Pill({ children, variant = "default", size = "sm", className }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "h-5 px-1.5 text-[10px] uppercase tracking-wide" : "h-6 px-2 text-xs",
        pillVariant[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
