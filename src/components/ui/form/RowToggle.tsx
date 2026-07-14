"use client";

import { Switch } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import { FormRow } from "./FormRow";

interface RowToggleProps {
  icon: LucideIcon;
  placeholder: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  "data-testid"?: string;
}

export function RowToggle({
  icon: Icon,
  placeholder,
  checked,
  onChange,
  className,
  "data-testid": dataTestid,
}: RowToggleProps) {
  return (
    <FormRow icon={<Icon size={20} />} className={className} data-testid={dataTestid}>
      <Switch
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        aria-label={placeholder}
        label={placeholder}
        size="md"
        color="tastile"
      />
    </FormRow>
  );
}
