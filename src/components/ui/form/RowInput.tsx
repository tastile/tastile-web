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
  ariaDescribedBy?: string;
  required?: boolean;
  invalid?: boolean;
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
  ariaDescribedBy,
  required = false,
  invalid = false,
}: RowInputProps) {
  return (
    <FormRow icon={<Icon size={20} />} trailing={trailing} className={className}>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        aria-required={required ? "true" : undefined}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={ariaDescribedBy}
        className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
      />
    </FormRow>
  );
}
