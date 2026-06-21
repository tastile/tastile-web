"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: "tiny" | "small" | "medium" | "large";
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, size = "small", ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex w-full rounded-md border border-border bg-surface-1 text-foreground text-xs",
          "focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-150",
          "cursor-pointer pr-8 appearance-none",
          // SVGの下矢印を背景にインラインで配置し、ブラウザ標準のやぼったい矢印を上書きする
          "bg-[image:url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%238a8f98%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')]",
          "bg-[position:right_10px_center] bg-[size:10px_auto] bg-no-repeat",
          size === "tiny" && "h-6 pl-2 pr-8 text-xs",
          size === "small" && "h-8 pl-2.5 pr-8 text-xs",
          size === "medium" && "h-9 pl-3 pr-8 text-sm",
          size === "large" && "h-10 pl-3 pr-8 text-sm",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";

export { Select };
