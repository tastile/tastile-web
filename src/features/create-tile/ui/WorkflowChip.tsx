"use client";

import { ChevronDown } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import {
  WORKFLOW_CONFIG,
  type WorkflowKind,
} from "@/features/create-tile/model/workflow-config";
import { useTranslation } from "@/shared/i18n/use-translation";

export interface WorkflowChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Currently selected workflow. When `null` the chip shows the picker placeholder. */
  workflow: WorkflowKind | null;
}

/**
 * Header chip showing the currently selected workflow (icon + label)
 * with a chevron to indicate the picker menu opens on click. Rendered
 * as a button so it can be the target of a Mantine Popover.
 */
export const WorkflowChip = forwardRef<HTMLButtonElement, WorkflowChipProps>(
  function WorkflowChip({ workflow, className, ...rest }, ref) {
    const { t } = useTranslation();
    const config = workflow ? WORKFLOW_CONFIG[workflow] : null;
    const Icon = config?.icon;
    const label = workflow
      ? t(`quickCreate.${config?.menuLabelKey ?? ""}`)
      : t("quickCreate.workflowSwitcher");

    return (
      <button
        ref={ref}
        type="button"
        aria-haspopup="menu"
        aria-label={t("quickCreate.workflowSwitcherAriaLabel")}
        className={
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2 py-1 text-sm font-medium text-foreground hover:bg-surface-2 " +
          (className ?? "")
        }
        {...rest}
      >
        {Icon ? (
          <Icon aria-hidden className="size-4 shrink-0" />
        ) : null}
        <span className="truncate">{label}</span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 opacity-70" />
      </button>
    );
  },
);
