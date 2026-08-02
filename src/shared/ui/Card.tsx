"use client";

import { cn } from "@/shared/lib/cn";
import { Paper } from "@mantine/core";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <Paper
      radius="md"
      withBorder
      shadow="xs"
      p={padded ? "md" : undefined}
      bg="var(--surface-1)"
      className={cn("border-border", className)}
    >
      {children}
    </Paper>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-foreground-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
