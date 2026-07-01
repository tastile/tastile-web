"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormRow } from "./FormRow";

interface RowSubPanelProps {
  icon: LucideIcon;
  name: string;
  value: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  emptyLabel?: string;
  disabled?: boolean;
}

export function RowSubPanel({
  icon: Icon,
  name,
  value,
  onClick,
  className,
  emptyLabel,
  disabled,
}: RowSubPanelProps) {
  const isEmpty = value.trim() === "";
  const _showEmptyLabel = isEmpty && emptyLabel;
  return (
    <FormRow
      icon={
        <Icon
          size={20}
          className={disabled ? "text-foreground-muted/50" : "text-foreground-muted"}
        />
      }
      trailing={disabled ? null : <ChevronRight size={16} className="text-foreground-muted" />}
      className={className}
    >
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-3 text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-background-control focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1",
          disabled ? "cursor-not-allowed opacity-50" : null,
        )}
      >
        <span className={cn("text-sm", disabled ? "text-foreground-muted" : "text-foreground")}>
          {name}
        </span>
        <span
          className={isEmpty ? "text-xs text-foreground-muted" : "text-sm text-foreground-muted"}
        >
          {isEmpty ? (emptyLabel ?? "未追加") : value}
        </span>
      </button>
    </FormRow>
  );
}
