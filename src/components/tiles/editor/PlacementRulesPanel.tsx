"use client";

import { ConditionKind } from "@/lib/domain/v1/constants";
import { uuidv7 } from "@/lib/domain/v1/envelope";
import type { PlacementRule } from "@/lib/domain/v1/tile";
import { ActionIcon, Button, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import { Plus, Trash2 } from "lucide-react";
import { ConditionEditor, defaultTerm } from "./ConditionEditor";

interface PlacementRulesPanelProps {
  rules: PlacementRule[];
  setRules: (rules: PlacementRule[]) => void;
  t: (key: string) => string;
  tileOptions: { value: string; label: string }[];
  taskOptions: { value: string; label: string }[];
  requirementOptions: { value: string; label: string }[];
}

function defaultRule(): PlacementRule {
  return {
    id: uuidv7(),
    when: null,
    rank: 0,
    effect: {
      kind: 0,
      scope: { kind: 0, parent: null, gap: null },
      span: null,
      score: null,
      record: null,
    },
  };
}

const initialCondition = () => ({
  kind: ConditionKind.TERM,
  children: [],
  term: defaultTerm("calendar"),
});

export function PlacementRulesPanel({
  rules,
  setRules,
  t,
  tileOptions,
  taskOptions,
  requirementOptions,
}: PlacementRulesPanelProps) {
  const update = (id: string, patch: Partial<PlacementRule>) =>
    setRules(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  return (
    <Stack gap="md" p="md">
      <div>
        <Text fw={600} size="sm">
          配置ルール
        </Text>
        <Text c="dimmed" size="xs">
          Permit / Deny / Limit / Score / Recordをrank付きの同じルール集合で評価します。
        </Text>
      </div>
      {rules.map((rule, index) => (
        <Stack key={rule.id} gap="sm" p="sm" className="rounded-lg border border-border">
          <Group justify="space-between">
            <Text fw={600} size="xs">
              Rule {index + 1}
            </Text>
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label="配置ルールを削除"
              onClick={() => setRules(rules.filter((item) => item.id !== rule.id))}
            >
              <Trash2 size={15} />
            </ActionIcon>
          </Group>
          <Group grow>
            <Select
              label="効果"
              value={String(rule.effect.kind)}
              data={[
                { value: "0", label: "Permit scope" },
                { value: "1", label: "Deny scope" },
                { value: "2", label: "Limit span" },
                { value: "3", label: "Score scope" },
                { value: "4", label: "Record requirement" },
              ]}
              onChange={(value) =>
                update(rule.id, {
                  effect: { ...rule.effect, kind: Number(value) },
                })
              }
            />
            <NumberInput
              label="rank"
              value={rule.rank}
              onChange={(value) => update(rule.id, { rank: Number(value) || 0 })}
            />
          </Group>
          {rule.when ? (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" fw={600}>
                  適用条件
                </Text>
                <Button
                  size="compact-xs"
                  variant="outline"
                  color="red"
                  onClick={() => update(rule.id, { when: null })}
                >
                  条件を外す
                </Button>
              </Group>
              <ConditionEditor
                node={rule.when}
                onChange={(when) => update(rule.id, { when })}
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
              onClick={() => update(rule.id, { when: initialCondition() })}
            >
              適用条件を追加
            </Button>
          )}
          {rule.effect.kind === 2 ? (
            <Group grow>
              <NumberInput
                label="最小時間（分）"
                min={0}
                value={(rule.effect.span?.minMs ?? 0) / 60_000}
                onChange={(value) =>
                  update(rule.id, {
                    effect: {
                      ...rule.effect,
                      span: {
                        minMs: (Number(value) || 0) * 60_000,
                        maxMs: rule.effect.span?.maxMs ?? null,
                      },
                    },
                  })
                }
              />
              <NumberInput
                label="最大時間（分）"
                min={0}
                value={(rule.effect.span?.maxMs ?? 0) / 60_000}
                onChange={(value) =>
                  update(rule.id, {
                    effect: {
                      ...rule.effect,
                      span: {
                        minMs: rule.effect.span?.minMs ?? null,
                        maxMs: (Number(value) || 0) * 60_000,
                      },
                    },
                  })
                }
              />
            </Group>
          ) : null}
          {rule.effect.kind === 3 ? (
            <NumberInput
              label="score"
              value={rule.effect.score ?? 0}
              onChange={(value) =>
                update(rule.id, {
                  effect: { ...rule.effect, score: Number(value) || 0 },
                })
              }
            />
          ) : null}
          {rule.effect.kind === 4 ? (
            <Select
              label="実行記録"
              value={String(rule.effect.record ?? 0)}
              data={[
                { value: "0", label: "任意" },
                { value: "1", label: "必須" },
              ]}
              onChange={(value) =>
                update(rule.id, {
                  effect: { ...rule.effect, record: Number(value) },
                })
              }
            />
          ) : null}
        </Stack>
      ))}
      <Button
        variant="outline"
        leftSection={<Plus size={15} />}
        onClick={() => setRules([...rules, defaultRule()])}
      >
        配置ルールを追加
      </Button>
    </Stack>
  );
}
