"use client";

import { SegmentedControl } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
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
  // When true, the segmented control stays intrinsic-width with overflow-x-scroll.
  // Default (false) makes the control fill the row.
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
  const data = options.map((opt) => ({ value: opt.value, label: opt.label }));
  return (
    <FormRow icon={<Icon size={20} />} tight className={className} data-testid={dataTestid}>
      <SegmentedControl
        value={value}
        onChange={(next) => onChange(next as V)}
        data={data}
        size="sm"
        fullWidth={!compact}
        radius="md"
        withItemsBorders={false}
        styles={{
          root: { backgroundColor: "var(--surface-2)" },
          indicator: { backgroundColor: "var(--surface-1)" },
          label: { color: "var(--foreground)" },
        }}
      />
    </FormRow>
  );
}
