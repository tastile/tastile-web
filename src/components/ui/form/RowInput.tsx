"use client";

import { TextInput } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import { FormRow } from "./FormRow";

interface RowInputProps {
  icon: LucideIcon;
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: "text" | "time" | "date" | "datetime-local" | "number";
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
      <TextInput
        value={value ?? ""}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        placeholder={placeholder}
        type={type}
        aria-label={ariaLabel ?? placeholder}
        aria-required={required ? "true" : undefined}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={ariaDescribedBy}
        required={required}
        error={invalid}
        size="sm"
        variant="unstyled"
        withAsterisk={false}
        styles={{
          input: {
            backgroundColor: "transparent",
            color: "var(--foreground)",
            fontSize: "0.875rem",
            lineHeight: "1.25rem",
            padding: 0,
            minHeight: "unset",
            height: "unset",
          },
        }}
      />
    </FormRow>
  );
}
