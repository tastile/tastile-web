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
  t: (key: string, params?: Record<string, string | number>) => string;
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
      <FormRow icon={<Scale className="size-4" aria-hidden />}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t("quickCreate.panel.placementRules.heading")}</span>
          <span className="text-xs text-foreground-muted">
            {t("quickCreate.panel.placementRules.description")}
          </span>
        </div>
      </FormRow>
      {rules.map((rule, index) => (
        <Stack key={rule.id} gap="sm" p="sm" className="rounded-lg border border-border">
          <Group justify="space-between">
            <Text fw={600} size="xs">
              {t("quickCreate.panel.placementRules.ruleIndexLabel", { index: index + 1 })}
            </Text>
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label={t("quickCreate.panel.placementRules.removeRuleAria")}
              onClick={() => setRules(rules.filter((item) => item.id !== rule.id))}
            >
              <Trash2 size={15} />
            </ActionIcon>
          </Group>
          <FormRow icon={<Scale className="size-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.placementRules.effectRankLabel")}</span>
              <Group grow>
                <Select
                  value={String(rule.effect.kind)}
                  data={[
                    { value: "0", label: t("quickCreate.panel.placementRules.effectPermit") },
                    { value: "1", label: t("quickCreate.panel.placementRules.effectDeny") },
                    { value: "2", label: t("quickCreate.panel.placementRules.effectLimit") },
                    { value: "3", label: t("quickCreate.panel.placementRules.effectScore") },
                    { value: "4", label: t("quickCreate.panel.placementRules.effectRecord") },
                  ]}
                  onChange={(value) =>
                    update(rule.id, {
                      effect: { ...rule.effect, kind: Number(value) },
                    })
                  }
                />
                <NumberInput
                  label={t("quickCreate.panel.placementRules.rankLabel")}
                  value={rule.rank}
                  onChange={(value) => update(rule.id, { rank: Number(value) || 0 })}
                />
              </Group>
            </div>
          </FormRow>
          {rule.when ? (
            <FormRow icon={<Filter className="size-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{t("quickCreate.panel.placementRules.conditionLabel")}</span>
                  <Button
                    size="compact-xs"
                    variant="outline"
                    color="red"
                    onClick={() => update(rule.id, { when: null })}
                  >
                    {t("quickCreate.panel.placementRules.removeCondition")}
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
              {t("quickCreate.panel.placementRules.addCondition")}
            </Button>
          )}
          {rule.effect.kind === 2 ? (
            <FormRow icon={<Clock className="size-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">{t("quickCreate.panel.placementRules.timeLimitLabel")}</span>
                <Group grow>
                  <NumberInput
                    label={t("quickCreate.panel.placementRules.minLabel")}
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
                    label={t("quickCreate.panel.placementRules.maxLabel")}
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
            <FormRow icon={<Star className="size-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">{t("quickCreate.panel.placementRules.scoreLabel")}</span>
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
            <FormRow icon={<FileCheck className="size-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">{t("quickCreate.panel.placementRules.executionRecordLabel")}</span>
                <Select
                  value={String(rule.effect.record ?? 0)}
                  data={[
                    { value: "0", label: t("quickCreate.panel.placementRules.recordOptional") },
                    { value: "1", label: t("quickCreate.panel.placementRules.recordRequired") },
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
        {t("quickCreate.panel.placementRules.addRule")}
      </Button>
    </Stack>
  );
}
