"use client";

import type { LucideIcon } from "lucide-react";
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
        className="flex w-full items-center text-left text-sm text-foreground-muted focus:outline-hidden"
      >
        {placeholder}
      </button>
      <div
        className={
          "relative h-5 w-9 rounded-full transition-colors " +
          (checked ? "bg-primary" : "bg-surface-3")
        }
      >
        <span
          className={
            "absolute top-0.5 h-4 w-4 rounded-full bg-surface-1 shadow transition-transform " +
            (checked ? "translate-x-4" : "translate-x-0.5")
          }
        />
      </div>
    </FormRow>
  );
}
