"use client";

import { ConditionKind } from "@/shared/model/v1/constants";
import { uuidv7 } from "@/shared/model/v1/envelope";
import type { PlacementRule } from "@/shared/model/v1/tile-types";
import { FormRow } from "@/shared/ui/form";
import { ActionIcon, Button, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import { ArrowUpDown, Clock, FileCheck, Filter, Plus, Scale, Star, Trash2 } from "lucide-react";
import { ConditionEditor } from "./ConditionEditor";
import { defaultTerm } from "./default-term";

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
      <FormRow icon={<Scale className="h-4 w-4" aria-hidden />}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">配置ルール</span>
          <span className="text-xs text-foreground-muted">
            Permit / Deny / Limit / Score / Recordをrank付きの同じルール集合で評価します。
          </span>
        </div>
      </FormRow>
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
          <FormRow icon={<Scale className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">効果 & Rank</span>
              <Group grow>
                <Select
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
            </div>
          </FormRow>
          {rule.when ? (
            <FormRow icon={<Filter className="h-4 w-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">適用条件</span>
                  <Button
                    size="compact-xs"
                    variant="outline"
                    color="red"
                    onClick={() => update(rule.id, { when: null })}
                  >
                    条件を外す
                  </Button>
                </div>
                <ConditionEditor
                  node={rule.when}
                  onChange={(when) => update(rule.id, { when })}
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
              onClick={() => update(rule.id, { when: initialCondition() })}
            >
              適用条件を追加
            </Button>
          )}
          {rule.effect.kind === 2 ? (
            <FormRow icon={<Clock className="h-4 w-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">時間制限（分）</span>
                <Group grow>
                  <NumberInput
                    label="最小"
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
                    label="最大"
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
              </div>
            </FormRow>
          ) : null}
          {rule.effect.kind === 3 ? (
            <FormRow icon={<Star className="h-4 w-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">Score</span>
                <NumberInput
                  value={rule.effect.score ?? 0}
                  onChange={(value) =>
                    update(rule.id, {
                      effect: { ...rule.effect, score: Number(value) || 0 },
                    })
                  }
                />
              </div>
            </FormRow>
          ) : null}
          {rule.effect.kind === 4 ? (
            <FormRow icon={<FileCheck className="h-4 w-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">実行記録</span>
                <Select
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
              </div>
            </FormRow>
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
