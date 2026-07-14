"use client";

import { Select } from "@mantine/core";
import type * as React from "react";

export interface DropdownItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  group?: string;
}

export interface DropdownProps {
  items: DropdownItem[];
  value?: string | null;
  defaultValue?: string | null;
  placeholder?: string;
  onChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: "tiny" | "small" | "medium" | "large";
  invalid?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  renderItem?: (item: DropdownItem, selected: boolean) => React.ReactNode;
  renderTrigger?: (selectedItem: DropdownItem | null, isOpen: boolean) => React.ReactNode;
  name?: string;
  "aria-label"?: string;
}

const SIZE_MAP: Record<NonNullable<DropdownProps["size"]>, string> = {
  tiny: "xs",
  small: "sm",
  medium: "md",
  large: "lg",
};

export function Dropdown({
  items,
  value,
  defaultValue,
  placeholder = "Select...",
  size = "small",
  invalid,
  disabled = false,
  searchable = false,
  onChange,
  onOpenChange,
  className,
  name,
  "aria-label": ariaLabel,
}: DropdownProps) {
  // Mantine Select uses `data` (string or {value,label}[]) and emits a single
  // string value. Items are mapped straight through — only string options are
  // supported by the existing callers. `renderItem` / `renderTrigger` /
  // `searchable` / `group` are accepted for API parity but no caller uses
  // them in the dashboard today; Mantine's own features cover the simple
  // value/label pickers that do flow through.
  const data = items.map((item) => ({
    value: item.value,
    label: item.label,
    disabled: item.disabled,
  }));
  const isControlled = value !== undefined;

  return (
    <Select
      data={data}
      value={isControlled ? (value ?? null) : undefined}
      defaultValue={defaultValue ?? undefined}
      placeholder={placeholder}
      size={SIZE_MAP[size]}
      error={invalid}
      disabled={disabled}
      searchable={searchable}
      aria-label={ariaLabel}
      name={name}
      allowDeselect={false}
      checkIconPosition="right"
      className={className}
      onChange={(next) => {
        if (next != null) onChange?.(next);
      }}
      onDropdownOpen={() => onOpenChange?.(true)}
      onDropdownClose={() => onOpenChange?.(false)}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
