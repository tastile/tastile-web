import { ConditionPanel } from "@/features/create-tile/ui/ConditionPanel";
import { type SubPanelKey, SubPanelShell } from "@/features/create-tile/ui/SubPanelShell";
import { defaultTerm } from "@/features/create-tile/ui/default-term";
import { FormPanel, SectionHeader } from "@/shared/ui/form";
import { SEGMENT_STYLES } from "@/shared/ui/panel-styles";
import type { ConditionNode } from "@/tile/model/v1/condition";
import { ConditionKind } from "@/tile/model/v1/constants";
import { Button, NumberInput, SegmentedControl } from "@mantine/core";
import { Check, Clock, ListChecks, Trash2, X } from "lucide-react";
import { useState } from "react";

export interface CompletionSubPanelProps {
  activePanel: SubPanelKey | null;
  setActivePanel: (panel: SubPanelKey) => void;
  isDesktop: boolean;
  t: (key: string) => string;
  plan: {
    completion: {
      root: ConditionNode;
      tasks: { id: string; content?: { title?: string } }[];
      timeRequirements: {
        id: string;
        required: { minMs: number | null };
        observation?: { scope?: number };
      }[];
    };
  };
  setField: (path: string, value: unknown) => void;
  tilePickerData: { value: string; label: string }[];
  taskPickerData: { value: string; label: string }[];
  requirementPickerData: { value: string; label: string }[];
  time: { durationMinMax: { minMs: number | null } };
}

export function CompletionSubPanel({
  activePanel,
  setActivePanel,
  isDesktop,
  t,
  plan,
  setField,
  tilePickerData,
  taskPickerData,
  requirementPickerData,
  time,
}: CompletionSubPanelProps) {
  const [lastConditionTab, setLastConditionTab] = useState<string | null>(null);

  return (
    <SubPanelShell
      panelKey="completion"
      activeKey={activePanel}
      onClose={() => setActivePanel("base")}
      headingId="completion-heading"
      title={t("quickCreate.completionNavTitle")}
      layout={isDesktop ? "drawer" : "sheet"}
    >
      <FormPanel>
        <SectionHeader icon={ListChecks} title={t("quickCreate.completionNavTitle")} />
        <ConditionPanel
          root={plan.completion.root}
          setField={setField}
          t={t}
          tileOptions={tilePickerData}
          taskOptions={taskPickerData}
          requirementOptions={requirementPickerData}
        />
        {plan.completion.timeRequirements.length > 0 && (
          <div
            className="flex flex-col gap-1.5 border-t border-border/40 pt-2"
            data-testid="completion-time-requirement-lines"
          >
            {plan.completion.timeRequirements.map((tr, i) => (
              <div
                key={tr.id}
                className="flex items-center gap-2 rounded-md bg-surface-1 px-2 py-1.5 text-sm"
                data-testid={`completion-time-line-${i}`}
              >
                <Clock size={16} className="shrink-0 text-foreground-muted" aria-hidden="true" />
                <span className="flex-1 text-foreground">
                  {tr.required.minMs !== null
                    ? `${Math.round(tr.required.minMs / 60000)} ${t("quickCreate.minutesUnit")}`
                    : t("quickCreate.duration")}
                </span>
                <NumberInput
                  min={5}
                  step={5}
                  aria-label={t("quickCreate.minutesUnit")}
                  value={
                    tr.required.minMs === null ? "" : Math.round((tr.required.minMs ?? 0) / 60000)
                  }
                  onChange={(value) => {
                    const next = plan.completion.timeRequirements.slice();
                    const v = value;
                    next[i] = {
                      ...tr,
                      required: {
                        ...tr.required,
                        minMs: v === "" || v === null ? null : Number(v) * 60000,
                      },
                    };
                    setField("plan.completion.timeRequirements", next);
                  }}
                  className="w-16"
                  size="xs"
                />
                <span className="text-xs text-foreground-muted">
                  {t("quickCreate.minutesUnit")}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="subtle"
                  leftSection={<Trash2 size={12} aria-hidden="true" />}
                  onClick={() => {
                    const next = plan.completion.timeRequirements.slice();
                    next.splice(i, 1);
                    setField("plan.completion.timeRequirements", next);
                  }}
                  aria-label={t("quickCreate.removeItem")}
                  className="text-foreground-muted hover:text-danger"
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
            {t("quickCreate.conditionAddTitle")}
          </div>
          <SegmentedControl
            fullWidth
            size="sm"
            radius="md"
            withItemsBorders={false}
            data-testid="completion-condition-tabs"
            value={lastConditionTab ?? undefined}
            onChange={(value) => {
              const termKind =
                value === "time"
                  ? null
                  : value === "task"
                    ? "task"
                    : value === "relation"
                      ? "relation"
                      : "metric";
              if (termKind === null) {
                const newTr = {
                  id: `tr_${Math.random().toString(36).slice(2, 9)}`,
                  observation: { scope: 0 as never },
                  required: { minMs: time.durationMinMax.minMs ?? 60 * 60000 },
                };
                setField("plan.completion.timeRequirements", [
                  ...plan.completion.timeRequirements,
                  newTr,
                ]);
                setLastConditionTab(value);
                return;
              }
              const child = defaultTerm(termKind);
              setField("plan.completion.root", {
                ...plan.completion.root,
                children: [...plan.completion.root.children, child],
              });
              setLastConditionTab(value);
            }}
            data={[
              { value: "time", label: t("quickCreate.completionBuilderTabTime") },
              { value: "task", label: t("quickCreate.completionBuilderTabTask") },
              { value: "relation", label: t("quickCreate.completionBuilderTabTile") },
              { value: "metric", label: t("quickCreate.completionBuilderTabRecord") },
            ]}
            styles={SEGMENT_STYLES}
          />
        </div>
        <div className="flex items-center gap-2 border-t border-border/40 pt-3">
          <Button
            type="button"
            size="sm"
            variant="subtle"
            leftSection={<Trash2 size={12} aria-hidden="true" />}
            onClick={() =>
              setField("plan.completion.root", {
                kind: ConditionKind.ALL,
                children: [],
                term: null,
              })
            }
            className="text-danger hover:bg-danger/10"
          >
            {t("quickCreate.completionRemoveLabel")}
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            size="sm"
            variant="default"
            leftSection={<X size={12} aria-hidden="true" />}
            onClick={() => setActivePanel("base")}
          >
            {t("quickCreate.completionCancelLabel")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="filled"
            leftSection={<Check size={12} aria-hidden="true" />}
            onClick={() => setActivePanel("base")}
            data-testid="completion-apply"
          >
            {t("quickCreate.completionBuilderApply")}
          </Button>
        </div>
      </FormPanel>
    </SubPanelShell>
  );
}
