"use client";

/**
 * ConditionPanel — plan.completion.root authoring surface extracted from
 * QuickCreate during Plan #6 (Tastile web study-life completion,
 * path-first scenario A).
 *
 * The UX is a verbatim lift of the inline block that used to live in
 * QuickCreate.tsx (lines 1441-1482 in the pre-extraction source):
 *   - "Builder logic" Select above (ALL / ANY / NOT) — written to
 *     plan.completion.root.kind
 *   - ConditionEditor below — recursively edits plan.completion.root
 *
 * The panel is store-agnostic: it does NOT call `useQuickCreateStore`
 * directly. The orchestrator (QuickCreate) reads the store slice and
 * passes it down via `root` + `setField`. This keeps the panel reusable
 * for tests and for any future "edit" mode that wants to bind it to a
 * different form context.
 *
 * NOTE: ConditionEditor has its own internal ConditionKindSegmented picker
 * (covers ALL/ANY/NOT/TERM). That picker is independent of the outer
 * "builder logic" Select — they serve different purposes and the outer
 * Select is preserved verbatim from the inline block. Do NOT collapse
 * the two tiers.
 *
 * data-testid contract (preserved from the inline block so any Playwright
 * scenario-A selectors keep working against the extracted component):
 *   - completion-condition-box   (panel root)
 *   - completion-logic-select    (builder-logic Select)
 */

import { Select } from "@mantine/core";

import type { ConditionNode } from "@/tile/model/v1/condition";
import { ConditionKind } from "@/tile/model/v1/constants";

import { ConditionEditor } from "./ConditionEditor";

export interface ConditionPanelProps {
  root: ConditionNode;
  setField: (path: string, value: unknown) => void;
  t: (k: string) => string;
  tileOptions?: { value: string; label: string }[];
  taskOptions?: { value: string; label: string }[];
  requirementOptions?: { value: string; label: string }[];
}

export function ConditionPanel({
  root,
  setField,
  t,
  tileOptions,
  taskOptions,
  requirementOptions,
}: ConditionPanelProps) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-0 p-3"
      data-testid="completion-condition-box"
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm font-semibold text-foreground">
          {t("quickCreate.completionBuilderLogicLabel")}
        </strong>
        <Select
          aria-label={t("quickCreate.completionBuilderLogicLabel")}
          value={String(root.kind) ?? null}
          onChange={(value) => {
            if (value == null) return;
            const nextKind = Number(value);
            setField("plan.completion.root", {
              ...root,
              kind: nextKind as never,
            });
          }}
          data-testid="completion-logic-select"
          data={[
            {
              value: String(ConditionKind.ALL),
              label: t("quickCreate.completionBuilderLogicAll"),
            },
            {
              value: String(ConditionKind.ANY),
              label: t("quickCreate.completionBuilderLogicAny"),
            },
            { value: String(ConditionKind.NOT), label: t("quickCreate.completionNot") },
          ]}
          comboboxProps={{ withinPortal: true }}
          allowDeselect={false}
        />
      </div>
      <ConditionEditor
        node={root}
        onChange={(next) => setField("plan.completion.root", next)}
        t={t}
        tileOptions={tileOptions}
        taskOptions={taskOptions}
        requirementOptions={requirementOptions}
      />
    </div>
  );
}
