import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormRow } from "./FormRow";

interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

interface RowSegmentedProps<V extends string> {
  icon: LucideIcon;
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}

export function RowSegmented<V extends string>({
  icon: Icon,
  options,
  value,
  onChange,
  className,
}: RowSegmentedProps<V>) {
  return (
    <FormRow icon={<Icon size={20} />} tight className={className}>
      <div role="radiogroup" className="flex w-full rounded-md bg-surface-2 p-0.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex-1 rounded-sm px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-surface-1 text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground",
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
