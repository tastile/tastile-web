"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-6",
        "sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="mb-2 text-xs font-medium text-ink-3">{eyebrow}</div>
        ) : null}
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-ink-1 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-pretty text-sm text-ink-3">{description}</p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
