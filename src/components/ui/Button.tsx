"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-hover shadow-sm",
  secondary:
    "bg-surface-1 text-ink-1 border border-border hover:bg-surface-2 hover:border-border-strong",
  ghost:
    "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink-1",
  outline:
    "bg-transparent text-ink-1 border border-border-strong hover:bg-surface-2",
  danger:
    "bg-status-danger text-white hover:opacity-90 active:opacity-80",
};

const sizeClass: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-8 px-3 text-sm gap-2",
  lg: "h-10 px-4 text-sm gap-2",
  icon: "h-8 w-8 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium",
        "transition-colors duration-fast ease-[var(--ease-out-expo)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "whitespace-nowrap select-none",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
});
