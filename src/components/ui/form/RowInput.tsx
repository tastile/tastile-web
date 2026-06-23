"use client";

import type { LucideIcon } from "lucide-react";
import { FormRow } from "./FormRow";

interface RowInputProps {
  icon: LucideIcon;
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: "text" | "time" | "date" | "datetime-local";
  trailing?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function RowInput({
  icon: Icon,
  placeholder,
  value,
  onChange,
  type = "text",
  trailing,
  className,
  ariaLabel,
}: RowInputProps) {
  return (
    <FormRow icon={<Icon size={20} />} trailing={trailing} className={className}>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
      />
    </FormRow>
  );
}
