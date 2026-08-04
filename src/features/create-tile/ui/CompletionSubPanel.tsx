import { ConditionPanel } from "@/features/create-tile/ui/ConditionPanel";
import { type SubPanelKey, SubPanelShell } from "@/features/create-tile/ui/SubPanelShell";
import { TaskDefinitionEditor } from "@/features/create-tile/ui/TaskDefinitionEditor";
import { defaultTerm } from "@/features/create-tile/ui/default-term";
import { FormPanel, SectionHeader } from "@/shared/ui/form";
import { SEGMENT_STYLES } from "@/shared/ui/panel-styles";
import type { ConditionNode } from "@/tile/model/v1/condition";
import { ConditionKind } from "@/tile/model/v1/constants";
import { Button, NumberInput, SegmentedControl, Tooltip } from "@mantine/core";
import { AlertTriangle, Check, Clock, ListChecks, Trash2, X } from "lucide-react";
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
        required: { minMs: number | null; maxMs: number | null };
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
            {plan.completion.timeRequirements.map((tr, i) => {
              const minMin =
                tr.required.minMs === null ? null : Math.round(tr.required.minMs / 60000);
              const maxMin =
                tr.required.maxMs === null ? null : Math.round(tr.required.maxMs / 60000);
              const hasMinMaxError =
                minMin !== null && maxMin !== null && minMin > maxMin;

              return (
                <div
                  key={tr.id}
                  className={`flex items-center gap-2 rounded-md bg-surface-1 px-2 py-1.5 text-sm ${
                    hasMinMaxError
                      ? "ring-1 ring-danger"
                      : ""
                  }`}
                  data-testid={`completion-time-line-${i}`}
                >
                  <Clock size={16} className="shrink-0 text-foreground-muted" aria-hidden="true" />
                  <SegmentedControl
                    size="xs"
                    radius="sm"
                    data={[
                      { value: "duration", label: t("quickCreate.timeReqKindDuration") },
                      { value: "deadline", label: t("quickCreate.timeReqKindDeadline") },
                      { value: "range", label: t("quickCreate.timeReqKindRange") },
                    ]}
                    value={
                      minMin !== null && maxMin !== null && minMin !== maxMin
                        ? "range"
                        : "duration"
                    }
                    onChange={() => {}}
                    className="shrink-0"
                    aria-label={t("quickCreate.timeReqKind")}
                  />
                  <span className="text-xs text-foreground-muted shrink-0">
                    {t("quickCreate.minMsLabel")}
                  </span>
                  <NumberInput
                    min={0}
                    step={5}
                    aria-label={t("quickCreate.minMsLabel")}
                    value={minMin ?? ""}
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
                  <span className="text-xs text-foreground-muted shrink-0">
                    {t("quickCreate.minutesUnit")}
                  </span>
                  <span className="text-xs text-foreground-muted shrink-0">
                    {t("quickCreate.maxMsLabel")}
                  </span>
                  <NumberInput
                    min={0}
                    step={5}
                    aria-label={t("quickCreate.maxMsLabel")}
                    value={maxMin ?? ""}
                    onChange={(value) => {
                      const next = plan.completion.timeRequirements.slice();
                      const v = value;
                      next[i] = {
                        ...tr,
                        required: {
                          ...tr.required,
                          maxMs: v === "" || v === null ? null : Number(v) * 60000,
                        },
                      };
                      setField("plan.completion.timeRequirements", next);
                    }}
                    className="w-16"
                    size="xs"
                  />
                  <span className="text-xs text-foreground-muted shrink-0">
                    {t("quickCreate.minutesUnit")}
                  </span>
                  {hasMinMaxError && (
                    <Tooltip label={t("quickCreate.durationRequired")}>
                      <AlertTriangle
                        size={14}
                        className="shrink-0 text-danger"
                        aria-label={t("quickCreate.durationRequired")}
                      />
                    </Tooltip>
                  )}
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
              );
            })}
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
                  required: {
                    minMs: time.durationMinMax.minMs ?? 60 * 60000,
                    maxMs: time.durationMinMax.minMs ?? 90 * 60000,
                  },
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
        <TaskDefinitionEditor t={t} />
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
