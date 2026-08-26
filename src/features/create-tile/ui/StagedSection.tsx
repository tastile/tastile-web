"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  required?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  digest?: ReactNode;
  children: ReactNode;
}

export function StagedSection({ title, required, isOpen, onToggle, digest, children }: Props) {
  const Icon = isOpen ? ChevronDown : ChevronRight;
  return (
    <section className="rounded-lg bg-[var(--surface-1)]">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icon size={16} aria-hidden />
          {title}
          {required ? (
            <span aria-hidden className="text-[var(--color-danger,#dc2626)]">
              *
            </span>
          ) : null}
        </span>
        <span className="text-xs text-[var(--foreground-muted)] flex items-center gap-2">
          {isOpen ? null : digest}
        </span>
      </button>
      {isOpen ? (
        <div className="bg-[var(--surface-2)] p-4">{children}</div>
      ) : null}
    </section>
  );
}
