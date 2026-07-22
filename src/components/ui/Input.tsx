"use client";

import { Textarea, TextInput } from "@mantine/core";
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const SIZE_MAP = {
  tiny: "xs",
  small: "xs",
  medium: "sm",
  large: "md",
} as const;

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: keyof typeof SIZE_MAP;
  invalid?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = "small", invalid, leading, trailing, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        size={SIZE_MAP[size]}
        error={invalid}
        leftSection={leading}
        rightSection={trailing}
        className={className}
        styles={{
          input: {
            backgroundColor: "var(--surface-1)",
            color: "var(--foreground)",
            borderColor: invalid ? "var(--danger)" : "var(--border)",
          },
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const TextareaBase = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <Textarea
        ref={ref}
        autosize={false}
        size="sm"
        error={invalid}
        className={className}
        styles={{
          input: {
            backgroundColor: "var(--surface-1)",
            color: "var(--foreground)",
            borderColor: invalid ? "var(--danger)" : "var(--border)",
          },
        }}
        {...props}
      />
    );
  },
);
TextareaBase.displayName = "Textarea";

function FieldLabel({
  htmlFor,
  children,
  hint,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {children}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {hint ? <span className="text-xs text-foreground-muted">{hint}</span> : null}
    </div>
  );
}

export { FieldLabel, Input, TextareaBase as Textarea };
