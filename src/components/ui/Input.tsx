"use client";

import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md";
  invalid?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = "md", invalid, leading, trailing, ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        "group flex w-full items-center gap-2 rounded-md border bg-surface-1",
        "transition-colors duration-fast ease-[var(--ease-out-expo)]",
        "focus-within:border-accent focus-within:ring-2 focus-within:ring-focus",
        invalid ? "border-status-danger" : "border-border",
        size === "sm" ? "h-7 px-2" : "h-8 px-2.5",
        className,
      )}
    >
      {leading ? (
        <span className="shrink-0 text-ink-3 group-focus-within:text-ink-1" aria-hidden>
          {leading}
        </span>
      ) : null}
      <input
        ref={ref}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-ink-1 outline-none placeholder:text-ink-4",
          size === "sm" ? "text-xs" : "text-sm",
        )}
        {...rest}
      />
      {trailing ? (
        <span className="shrink-0 text-ink-3 group-focus-within:text-ink-1" aria-hidden>
          {trailing}
        </span>
      ) : null}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "block w-full rounded-md border bg-surface-1 px-2.5 py-2 text-sm text-ink-1 outline-none",
        "placeholder:text-ink-4 transition-colors duration-fast ease-[var(--ease-out-expo)]",
        "focus:border-accent focus:ring-2 focus:ring-focus",
        invalid ? "border-status-danger" : "border-border",
        className,
      )}
      {...rest}
    />
  );
});

export function FieldLabel({
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
        className="text-xs font-medium text-ink-2 tracking-wide"
      >
        {children}
        {required ? <span className="ml-0.5 text-status-danger">*</span> : null}
      </label>
      {hint ? <span className="text-xs text-ink-4">{hint}</span> : null}
    </div>
  );
}
