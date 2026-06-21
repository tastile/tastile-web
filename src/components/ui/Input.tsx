"use client";

import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const inputVariants = cva(
  [
    "flex w-full rounded-md border bg-surface-1",
    "px-3 py-2 text-sm",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "placeholder:text-foreground-muted",
    "read-only:text-foreground-muted",
    "read-only:cursor-not-allowed",
    "focus:ring-background-control focus:border-control",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-background-control",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-foreground-muted",
    "disabled:cursor-not-allowed disabled:text-foreground-muted",
    "transition-colors duration-200",
  ].join(" "),
  {
    variants: {
      size: {
        tiny: "h-6 px-2 text-xs",
        small: "h-8 px-2.5 text-xs",
        medium: "h-9 px-3 text-sm",
        large: "h-10 px-3 text-sm",
      },
      invalid: {
        true: "border-danger focus-visible:ring-danger",
      },
    },
    defaultVariants: {
      size: "small",
    },
  }
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = "small", invalid, leading, trailing, ...props }, ref) => {
    return (
      <div
        className={cn(
          "group flex w-full items-center gap-2 rounded-md border bg-surface-1",
          "transition-colors duration-200",
          "focus-within:border-control focus-within:ring-2 focus-within:ring-background-control",
          "focus-within:ring-offset-2 focus-within:ring-offset-foreground-muted",
          invalid ? "border-danger focus-within:ring-danger" : "border-border",
          size === "tiny" && "h-6 px-2",
          size === "small" && "h-8 px-2.5",
          size === "medium" && "h-9 px-3",
          size === "large" && "h-10 px-3",
          className,
        )}
      >
        {leading ? (
          <span className="shrink-0 text-foreground-muted group-focus-within:text-foreground" aria-hidden>
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-foreground-muted",
            size === "tiny" && "text-xs",
            size === "small" && "text-xs",
            size === "medium" && "text-sm",
            size === "large" && "text-sm",
          )}
          readOnly={props.readOnly}
          disabled={props.disabled}
          aria-invalid={invalid || undefined}
          {...props}
        />
        {trailing ? (
          <span className="shrink-0 text-foreground-muted group-focus-within:text-foreground" aria-hidden>
            {trailing}
          </span>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "block w-full rounded-md border bg-surface-1",
          "px-3 py-2 text-sm text-foreground outline-none",
          "placeholder:text-foreground-muted",
          "transition-colors duration-200",
          "focus:border-control focus:ring-2 focus:ring-background-control",
          "focus:ring-offset-2 focus:ring-offset-foreground-muted",
          invalid ? "border-danger focus:ring-danger" : "border-border",
          "disabled:cursor-not-allowed disabled:text-foreground-muted",
          className,
        )}
        disabled={props.disabled}
        readOnly={props.readOnly}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

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
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground"
      >
        {children}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {hint ? <span className="text-xs text-foreground-muted">{hint}</span> : null}
    </div>
  );
}

export { Input, Textarea, FieldLabel, inputVariants };
