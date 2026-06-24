"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormRow } from "./FormRow";

interface RowToggleProps {
  icon: LucideIcon;
  placeholder: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function RowToggle({ icon: Icon, placeholder, checked, onChange, className }: RowToggleProps) {
  return (
    <FormRow icon={<Icon size={20} />} className={className}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={placeholder}
        onClick={() => onChange(!checked)}
        className="flex w-full items-center justify-between gap-3 text-left text-sm text-foreground-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-background-control focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
      >
        <span>{placeholder}</span>
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
            checked
              ? "border-primary bg-primary"
              : "border-border bg-surface-2",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
              checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
        </span>
      </button>
    </FormRow>
  );
}
