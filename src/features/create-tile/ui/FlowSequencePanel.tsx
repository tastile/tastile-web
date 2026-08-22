"use client";

import { ConditionKind } from "@/shared/model/v1/constants";
import { uuidv7 } from "@/shared/model/v1/envelope";
import type { SourceAuthoringSlice } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import {
  ActionIcon,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { ArrowRightLeft, Bell, Filter, GitMerge, ListOrdered, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ConditionEditor } from "./ConditionEditor";
import { defaultTerm } from "./default-term";

type FlowSequence = SourceAuthoringSlice["flowSequences"][number];

const initialCondition = () => ({
  kind: ConditionKind.TERM,
  children: [],
  term: defaultTerm("calendar"),
});

interface FlowSequencePanelProps {
  flows: FlowSequence[];
  setFlows: (flows: FlowSequence[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tileOptions: { value: string; label: string }[];
  taskOptions: { value: string; label: string }[];
  requirementOptions: { value: string; label: string }[];
}

const SIGNAL_VALUES: FlowSequence["observes"][number][] = [
  "PlacementCreated",
  "PlacementUpdated",
  "PlacementClosed",
  "ExecutionStarted",
  "ExecutionFinished",
  "FactChanged",
  "MetricChanged",
];

const signalLabelKey: Record<FlowSequence["observes"][number], string> = {
  PlacementCreated: "quickCreate.panel.flow.signalPlacementCreated",
  PlacementUpdated: "quickCreate.panel.flow.signalPlacementUpdated",
  PlacementClosed: "quickCreate.panel.flow.signalPlacementClosed",
  ExecutionStarted: "quickCreate.panel.flow.signalExecutionStarted",
  ExecutionFinished: "quickCreate.panel.flow.signalExecutionFinished",
  FactChanged: "quickCreate.panel.flow.signalFactChanged",
  MetricChanged: "quickCreate.panel.flow.signalMetricChanged",
};

function defaultFlow(): FlowSequence {
  return {
    id: uuidv7(),
    observes: ["PlacementCreated"],
    when: null,
    candidateWhen: null,
    minimumGapMs: 20 * 60_000,
    rank: 0,
    cycle: false,
    resetOnInterrupt: false,
    steps: [
      {
        id: uuidv7(),
        waitBeforeMs: 15 * 60_000,
        emitDurationMs: 5 * 60_000,
      },
    ],
  };
}

export function FlowSequencePanel({
  flows,
  setFlows,
  t,
  tileOptions,
  taskOptions,
  requirementOptions,
}: FlowSequencePanelProps) {
  const update = (id: string, patch: Partial<FlowSequence>) =>
    setFlows(flows.map((flow) => (flow.id === id ? { ...flow, ...patch } : flow)));

  const signalOptions = SIGNAL_VALUES.map((value) => ({
    value,
    label: t(signalLabelKey[value]),
  }));

  return (
    <Stack gap="md" p="md">
      <FormRow icon={<ListOrdered className="h-4 w-4" aria-hidden />}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t("quickCreate.panel.flow.heading")}</span>
          <span className="text-xs text-foreground-muted">
            {t("quickCreate.panel.flow.description")}
          </span>
        </div>
      </FormRow>
      {flows.map((flow, flowIndex) => (
        <Stack key={flow.id} gap="sm" p="sm" className="rounded-lg border border-border">
          <Group justify="space-between">
            <Text fw={600} size="xs">
              {t("quickCreate.panel.flow.flowIndexLabel", { index: flowIndex + 1 })}
            </Text>
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label={t("quickCreate.panel.flow.removeFlowAria")}
              onClick={() => setFlows(flows.filter((item) => item.id !== flow.id))}
            >
              <Trash2 size={15} />
            </ActionIcon>
          </Group>
          <FormRow icon={<Bell className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.flow.observesLabel")}</span>
              <MultiSelect
                data={signalOptions}
                value={flow.observes}
                onChange={(value) => update(flow.id, { observes: value as FlowSequence["observes"] })}
              />
            </div>
          </FormRow>
          {flow.when ? (
            <FormRow icon={<Filter className="h-4 w-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{t("quickCreate.panel.flow.flowConditionLabel")}</span>
                  <Button
                    size="compact-xs"
                    variant="outline"
                    color="red"
                    onClick={() => update(flow.id, { when: null })}
                  >
                    {t("quickCreate.panel.flow.removeCondition")}
                  </Button>
                </div>
                <ConditionEditor
                  node={flow.when}
                  onChange={(when) => update(flow.id, { when })}
                  t={t}
                  tileOptions={tileOptions}
                  taskOptions={taskOptions}
                  requirementOptions={requirementOptions}
                />
              </div>
            </FormRow>
          ) : (
            <Button
              size="xs"
              variant="outline"
              onClick={() => update(flow.id, { when: initialCondition() })}
            >
              {t("quickCreate.panel.flow.addFlowCondition")}
            </Button>
          )}
          {flow.candidateWhen ? (
            <FormRow icon={<GitMerge className="h-4 w-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{t("quickCreate.panel.flow.candidateConditionLabel")}</span>
                  <Button
                    size="compact-xs"
                    variant="outline"
                    color="red"
                    onClick={() => update(flow.id, { candidateWhen: null })}
                  >
                    {t("quickCreate.panel.flow.removeCondition")}
                  </Button>
                </div>
                <ConditionEditor
                  node={flow.candidateWhen}
                  onChange={(candidateWhen) => update(flow.id, { candidateWhen })}
                  t={t}
                  tileOptions={tileOptions}
                  taskOptions={taskOptions}
                  requirementOptions={requirementOptions}
                />
              </div>
            </FormRow>
          ) : (
            <Button
              size="xs"
              variant="outline"
              onClick={() => update(flow.id, { candidateWhen: initialCondition() })}
            >
              {t("quickCreate.panel.flow.addCandidateCondition")}
            </Button>
          )}
          <FormRow icon={<ArrowRightLeft className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.flow.gapRankLabel")}</span>
              <Group grow>
                <NumberInput
                  label={t("quickCreate.panel.flow.minGapLabel")}
                  min={0}
                  value={flow.minimumGapMs / 60_000}
                  onChange={(value) => update(flow.id, { minimumGapMs: (Number(value) || 0) * 60_000 })}
                />
                <NumberInput
                  label={t("quickCreate.panel.flow.rankLabel")}
                  value={flow.rank}
                  onChange={(value) => update(flow.id, { rank: Number(value) || 0 })}
                />
              </Group>
            </div>
          </FormRow>
          <FormRow icon={<RefreshCw className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.flow.cycleSettingsLabel")}</span>
              <Group grow>
                <Switch
                  size="xs"
                  label={t("quickCreate.panel.flow.cycleLabel")}
                  checked={flow.cycle}
                  onChange={(e) => update(flow.id, { cycle: e.currentTarget.checked })}
                  data-testid={`flow-cycle-${flowIndex}`}
                />
                <Switch
                  size="xs"
                  label={t("quickCreate.panel.flow.resetOnInterruptLabel")}
                  checked={flow.resetOnInterrupt}
                  disabled={!flow.cycle}
                  onChange={(e) => update(flow.id, { resetOnInterrupt: e.currentTarget.checked })}
                  data-testid={`flow-reset-${flowIndex}`}
                />
              </Group>
            </div>
          </FormRow>
          {flow.cycle && (
            <Text size="xs" c="dimmed">
              {t("quickCreate.panel.flow.cycleSummary", {
                count: flow.steps.length,
                avg: Math.round(
                  flow.steps.reduce((s, st) => s + st.waitBeforeMs + st.emitDurationMs, 0) /
                    flow.steps.length /
                    60000,
                ),
                total: Math.round(
                  flow.steps.reduce((s, st) => s + st.waitBeforeMs + st.emitDurationMs, 0) / 60000,
                ),
              })}
            </Text>
          )}
          {flow.steps.map((step, stepIndex) => (
            <Group key={step.id} grow align="end">
              <NumberInput
                label={t("quickCreate.panel.flow.stepWaitLabel", { index: stepIndex + 1 })}
                min={0}
                value={step.waitBeforeMs / 60_000}
                onChange={(value) =>
                  update(flow.id, {
                    steps: flow.steps.map((item) =>
                      item.id === step.id
                        ? { ...item, waitBeforeMs: (Number(value) || 0) * 60_000 }
                        : item,
                    ),
                  })
                }
              />
              <NumberInput
                label={t("quickCreate.panel.flow.stepEmitLabel")}
                min={1}
                value={step.emitDurationMs / 60_000}
                onChange={(value) =>
                  update(flow.id, {
                    steps: flow.steps.map((item) =>
                      item.id === step.id
                        ? { ...item, emitDurationMs: (Number(value) || 1) * 60_000 }
                        : item,
                    ),
                  })
                }
              />
              <ActionIcon
                color="red"
                variant="subtle"
                aria-label={t("quickCreate.panel.flow.removeStepAria")}
                onClick={() =>
                  update(flow.id, {
                    steps: flow.steps.filter((item) => item.id !== step.id),
                  })
                }
              >
                <Trash2 size={15} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="outline"
            leftSection={<Plus size={14} />}
            onClick={() =>
              update(flow.id, {
                steps: [
                  ...flow.steps,
                  {
                    id: uuidv7(),
                    waitBeforeMs: 15 * 60_000,
                    emitDurationMs: 5 * 60_000,
                  },
                ],
              })
            }
          >
            {t("quickCreate.panel.flow.addStep")}
          </Button>
        </Stack>
      ))}
      <Button
        variant="outline"
        leftSection={<Plus size={15} />}
        onClick={() => setFlows([...flows, defaultFlow()])}
      >
        {t("quickCreate.panel.flow.addFlow")}
      </Button>
    </Stack>
  );
}
