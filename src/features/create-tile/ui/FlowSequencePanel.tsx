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
  t: (key: string) => string;
  tileOptions: { value: string; label: string }[];
  taskOptions: { value: string; label: string }[];
  requirementOptions: { value: string; label: string }[];
}

const signalOptions: Array<{ value: FlowSequence["observes"][number]; label: string }> = [
  { value: "PlacementCreated", label: "Placement作成" },
  { value: "PlacementUpdated", label: "Placement更新" },
  { value: "PlacementClosed", label: "Placement終了" },
  { value: "ExecutionStarted", label: "Execution開始" },
  { value: "ExecutionFinished", label: "Execution完了" },
  { value: "FactChanged", label: "Fact変更" },
  { value: "MetricChanged", label: "Metric変更" },
];

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

  return (
    <Stack gap="md" p="md">
      <FormRow icon={<ListOrdered className="h-4 w-4" aria-hidden />}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">条件駆動ワークフロー</span>
          <span className="text-xs text-foreground-muted">
            eventを観測し、gap内へ待ち時間と生成時間のsequenceを繰り返します。
          </span>
        </div>
      </FormRow>
      {flows.map((flow, flowIndex) => (
        <Stack key={flow.id} gap="sm" p="sm" className="rounded-lg border border-border">
          <Group justify="space-between">
            <Text fw={600} size="xs">
              Flow {flowIndex + 1}
            </Text>
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label="Flowを削除"
              onClick={() => setFlows(flows.filter((item) => item.id !== flow.id))}
            >
              <Trash2 size={15} />
            </ActionIcon>
          </Group>
          <FormRow icon={<Bell className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">観測event</span>
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
                  <span className="text-xs font-medium">Flow適用条件</span>
                  <Button
                    size="compact-xs"
                    variant="outline"
                    color="red"
                    onClick={() => update(flow.id, { when: null })}
                  >
                    条件を外す
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
              Flow適用条件を追加
            </Button>
          )}
          {flow.candidateWhen ? (
            <FormRow icon={<GitMerge className="h-4 w-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">候補条件</span>
                  <Button
                    size="compact-xs"
                    variant="outline"
                    color="red"
                    onClick={() => update(flow.id, { candidateWhen: null })}
                  >
                    条件を外す
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
              候補条件を追加
            </Button>
          )}
          <FormRow icon={<ArrowRightLeft className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">Gap & Rank</span>
              <Group grow>
                <NumberInput
                  label="対象gap 最小（分）"
                  min={0}
                  value={flow.minimumGapMs / 60_000}
                  onChange={(value) => update(flow.id, { minimumGapMs: (Number(value) || 0) * 60_000 })}
                />
                <NumberInput
                  label="候補rank"
                  value={flow.rank}
                  onChange={(value) => update(flow.id, { rank: Number(value) || 0 })}
                />
              </Group>
            </div>
          </FormRow>
          <FormRow icon={<RefreshCw className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">循環設定</span>
              <Group grow>
                <Switch
                  size="xs"
                  label="循環（最終step後先頭に戻る）"
                  checked={flow.cycle}
                  onChange={(e) => update(flow.id, { cycle: e.currentTarget.checked })}
                  data-testid={`flow-cycle-${flowIndex}`}
                />
                <Switch
                  size="xs"
                  label="割り込みでリセット"
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
              循環時: {flow.steps.length} steps × 平均{" "}
              {Math.round(
                flow.steps.reduce((s, st) => s + st.waitBeforeMs + st.emitDurationMs, 0) /
                  flow.steps.length /
                  60000,
              )}{" "}
              分 / 1周{" "}
              {Math.round(
                flow.steps.reduce((s, st) => s + st.waitBeforeMs + st.emitDurationMs, 0) / 60000,
              )}{" "}
              分
            </Text>
          )}
          {flow.steps.map((step, stepIndex) => (
            <Group key={step.id} grow align="end">
              <NumberInput
                label={`Step ${stepIndex + 1} 待ち（分）`}
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
                label="生成時間（分）"
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
                aria-label="Stepを削除"
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
            Stepを追加
          </Button>
        </Stack>
      ))}
      <Button
        variant="outline"
        leftSection={<Plus size={15} />}
        onClick={() => setFlows([...flows, defaultFlow()])}
      >
        Flowを追加
      </Button>
    </Stack>
  );
}
