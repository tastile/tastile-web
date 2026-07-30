"use client";

import { ConditionKind } from "@/lib/domain/v1/constants";
import { uuidv7 } from "@/lib/domain/v1/envelope";
import type { SourceAuthoringSlice } from "@/lib/stores/quick-create-store";
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
import { Plus, Trash2 } from "lucide-react";
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
      <div>
        <Text fw={600} size="sm">
          条件駆動ワークフロー
        </Text>
        <Text c="dimmed" size="xs">
          eventを観測し、gap内へ待ち時間と生成時間のsequenceを繰り返します。
        </Text>
      </div>
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
          <MultiSelect
            label="観測event"
            data={signalOptions}
            value={flow.observes}
            onChange={(value) => update(flow.id, { observes: value as FlowSequence["observes"] })}
          />
          {flow.when ? (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" fw={600}>
                  Flow適用条件
                </Text>
                <Button
                  size="compact-xs"
                  variant="outline"
                  color="red"
                  onClick={() => update(flow.id, { when: null })}
                >
                  条件を外す
                </Button>
              </Group>
              <ConditionEditor
                node={flow.when}
                onChange={(when) => update(flow.id, { when })}
                t={t}
                tileOptions={tileOptions}
                taskOptions={taskOptions}
                requirementOptions={requirementOptions}
              />
            </Stack>
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
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" fw={600}>
                  候補条件
                </Text>
                <Button
                  size="compact-xs"
                  variant="outline"
                  color="red"
                  onClick={() => update(flow.id, { candidateWhen: null })}
                >
                  条件を外す
                </Button>
              </Group>
              <ConditionEditor
                node={flow.candidateWhen}
                onChange={(candidateWhen) => update(flow.id, { candidateWhen })}
                t={t}
                tileOptions={tileOptions}
                taskOptions={taskOptions}
                requirementOptions={requirementOptions}
              />
            </Stack>
          ) : (
            <Button
              size="xs"
              variant="outline"
              onClick={() => update(flow.id, { candidateWhen: initialCondition() })}
            >
              候補条件を追加
            </Button>
          )}
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
