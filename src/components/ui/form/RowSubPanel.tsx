"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { FormRow } from "./FormRow";

interface RowSubPanelProps {
  icon: LucideIcon;
  name: string;
  value: string;
  onClick: () => void;
  className?: string;
}

export function RowSubPanel({ icon: Icon, name, value, onClick, className }: RowSubPanelProps) {
  return (
    <FormRow
      icon={<Icon size={20} />}
      trailing={<ChevronRight size={16} className="text-foreground-muted" />}
      className={className}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={name}
        className="flex w-full items-center justify-between gap-3 text-left focus:outline-hidden"
      >
        <span className="text-sm text-foreground">{name}</span>
        <span className="text-sm text-foreground-muted">{value}</span>
      </button>
    </FormRow>
  );
}
