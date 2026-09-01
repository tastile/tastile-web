"use client";

import {
  WORKFLOW_CONFIG,
  WORKFLOW_ORDER,
  type WorkflowKind,
} from "@/features/create-tile/model/workflow-config";
import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";

/**
 * Horizontal batch row for workflow switching (Google Calendar style).
 *
 * Renders all workflow kinds as pill buttons in a horizontally scrollable
 * row. The active kind is visually filled. The row scrolls freely so the
 * user can reach items that overflow both left and right edges.
 */
export function WorkflowBatch() {
  const { t } = useTranslation();
  const activeKind = useQuickCreateStore((s) => s.workflowKind);
  const setWorkflow = useQuickCreateStore((s) => s.setWorkflow);

  function handleSelect(kind: WorkflowKind) {
    setWorkflow(kind);
  }

  return (
    <div className="overflow-x-auto px-4 py-1.5">
      <div className="flex w-max gap-1.5 pl-8">
        {WORKFLOW_ORDER.map((kind) => {
          const config = WORKFLOW_CONFIG[kind];
          const Icon = config.icon;
          const active = kind === activeKind;
          const label = t(`quickCreate.${config.menuLabelKey}`);

          return (
            <button
              key={kind}
              type="button"
              onClick={() => handleSelect(kind)}
              data-testid={`workflow-batch-${kind}`}
              aria-pressed={active}
              className={
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors " +
                (active
                  ? "bg-primary text-primary-fg"
                  : "border-border bg-surface-1 text-foreground-muted hover:bg-surface-2")
              }
            >
              <Icon aria-hidden className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
