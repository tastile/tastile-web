"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center",
    "cursor-pointer",
    "space-x-2",
    "text-center",
    "font-regular",
    "ease-out",
    "duration-200",
    "rounded-md",
    "outline-hidden",
    "transition-all",
    "outline-0",
    "focus-visible:outline-solid",
    "focus-visible:outline-4",
    "focus-visible:outline-offset-1",
    "border",
    "disabled:opacity-50",
    "disabled:cursor-not-allowed",
    "disabled:pointer-events-none",
    "whitespace-nowrap",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-primary text-primary-fg",
          "hover:bg-primary-hover",
          "border-primary/75",
          "hover:border-primary",
          "focus-visible:outline-primary",
          "data-[state=open]:bg-primary/80",
          "data-[state=open]:outline-primary",
        ].join(" "),
        default: [
          "text-foreground",
          "bg-surface-1 hover:bg-surface-2",
          "border-border hover:border-border-strong",
          "focus-visible:outline-border",
          "data-[state=open]:bg-surface-2",
          "data-[state=open]:outline-border",
        ].join(" "),
        secondary: [
          "bg-foreground",
          "text-background hover:text-border-strong",
          "focus-visible:text-border-control",
          "border-foreground-light hover:border-foreground-lighter",
          "focus-visible:outline-border",
          "data-[state=open]:border-foreground-lighter",
          "data-[state=open]:outline-border",
        ].join(" "),
        outline: [
          "text-foreground",
          "bg-transparent",
          "border-border hover:border-foreground-muted",
          "focus-visible:outline-border",
          "data-[state=open]:border-border-strong",
          "data-[state=open]:outline-border",
        ].join(" "),
        dashed: [
          "text-foreground",
          "border",
          "border-dashed",
          "border-border hover:border-border-strong",
          "bg-transparent",
          "focus-visible:outline-border",
          "data-[state=open]:border-border-strong",
          "data-[state=open]:outline-border",
        ].join(" "),
        link: [
          "text-primary",
          "border",
          "border-transparent/0",
          "hover:bg-primary/10",
          "shadow-none",
          "focus-visible:outline-border",
          "data-[state=open]:bg-primary/10",
          "data-[state=open]:outline-border",
        ].join(" "),
        text: [
          "text-foreground",
          "hover:bg-surface-2",
          "shadow-none",
          "focus-visible:outline-border",
          "data-[state=open]:bg-surface-2",
          "data-[state=open]:outline-border",
          "border-transparent",
        ].join(" "),
        danger: [
          // Borderless on purpose: the filled danger tint already signals
          // destructive intent, and a border stacked on a tinted background
          // reads as a heavy outlined button. The base styles still apply a
          // 1px border (kept transparent here so `border` utilities from
          // className overrides still work).
          "text-foreground",
          "bg-danger/20 hover:bg-danger/30",
          "border-transparent",
          "hover:text-foreground",
          "focus-visible:outline-danger",
          "data-[state=open]:bg-danger/30",
          "data-[state=open]:outline-danger",
        ].join(" "),
        warning: [
          "text-foreground",
          "bg-warning/20 hover:bg-warning/30",
          "border-warning hover:border-warning",
          "hover:text-foreground",
          "focus-visible:outline-warning",
          "data-[state=open]:border-warning",
          "data-[state=open]:bg-warning/30",
          "data-[state=open]:outline-warning",
        ].join(" "),
        ghost: [
          "text-foreground-muted",
          "bg-transparent",
          "border-transparent",
          "hover:bg-surface-2 hover:text-foreground",
          "focus-visible:outline-border",
          "data-[state=open]:bg-surface-2",
          "data-[state=open]:outline-border",
        ].join(" "),
      },
      size: {
        tiny: "h-6 px-2 text-xs",
        small: "h-8 px-3 text-xs",
        medium: "h-9 px-4 text-sm",
        large: "h-10 px-4 text-sm",
        xlarge: "h-11 px-6 text-sm",
        xxlarge: "h-12 px-8 text-base",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
        "icon-xs": "h-6 w-6 p-0",
      },
      block: {
        true: "w-full",
      },
      rounded: {
        true: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "medium",
    },
  },
);

const iconContainerVariants = cva("inline-flex items-center justify-center shrink-0", {
  variants: {
    size: {
      tiny: "[&_svg]:h-3.5 [&_svg]:w-3.5",
      small: "[&_svg]:h-4 [&_svg]:w-4",
      medium: "[&_svg]:h-5 [&_svg]:w-5",
      large: "[&_svg]:h-5 [&_svg]:w-5",
      xlarge: "[&_svg]:h-5 [&_svg]:w-5",
      xxlarge: "[&_svg]:h-6 [&_svg]:w-6",
      icon: "[&_svg]:h-4 [&_svg]:w-4",
      "icon-sm": "[&_svg]:h-4 [&_svg]:w-4",
      "icon-xs": "[&_svg]:h-3.5 [&_svg]:w-3.5",
    },
  },
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "medium",
      loading = false,
      disabled = false,
      block,
      rounded,
      icon,
      iconLeft,
      iconRight,
      children,
      ...props
    },
    ref,
  ) => {
    const _iconLeft = icon ?? iconLeft;
    const isDisabled = loading || disabled;

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        className={cn(buttonVariants({ variant, size, block, rounded }), className)}
        {...props}
      >
        {loading ? (
          <div className={cn(iconContainerVariants({ size }))}>
            <Loader2 className="animate-spin" />
          </div>
        ) : _iconLeft ? (
          <div className={cn(iconContainerVariants({ size }))}>{_iconLeft}</div>
        ) : null}
        {children && <span className="truncate">{children}</span>}
        {iconRight && !loading && (
          <div className={cn(iconContainerVariants({ size }))}>{iconRight}</div>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
