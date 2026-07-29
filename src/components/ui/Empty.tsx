"use client";

import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-0 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="text-ink-3" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-ink-1">{title}</h3>
      {description ? <p className="max-w-md text-sm text-ink-3">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
