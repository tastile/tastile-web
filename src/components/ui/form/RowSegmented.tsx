"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormRow } from "./FormRow";

interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

interface RowSegmentedProps<V extends string> {
  "data-testid"?: string;
  icon: LucideIcon;
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
  // When true, buttons stay intrinsic-width and overflow-x-scroll.
  // Default (false) makes each button grow to fill the row.
  compact?: boolean;
}

export function RowSegmented<V extends string>({
  icon: Icon,
  options,
  value,
  onChange,
  className,
  compact = false,
  "data-testid": dataTestid,
}: RowSegmentedProps<V>) {
  return (
    <FormRow icon={<Icon size={20} />} tight className={className} data-testid={dataTestid}>
      <div
        role="radiogroup"
        className={cn(
          "flex w-full min-w-0 gap-1",
          compact ? "flex-nowrap overflow-x-auto whitespace-nowrap" : "flex-wrap",
        )}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            // biome-ignore lint/a11y/useSemanticElements: custom button-styled segmented control requires role="radio" on a button for visual flexibility
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                compact ? "shrink-0 whitespace-nowrap" : "min-w-0 flex-1 truncate",
                active
                  ? "bg-primary text-primary-fg border-primary shadow-sm"
                  : "bg-surface-1 text-foreground-muted border-border hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </FormRow>
  );
}
