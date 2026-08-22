"use client";

import { type SourceTileRead, listSourceTiles } from "@/shared/api/v1/source-tiles";
import { makeClient } from "@/shared/api/v1/submit";
import { useTranslation } from "@/shared/i18n/use-translation";
import { uuidv7 } from "@/shared/model/v1/envelope";
import type { SourceRelationDraft } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { ActionIcon, Alert, Button, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import { ArrowUp, ArrowUpRight, Clock, ExternalLink, Hash, MoveHorizontal, Network, Plus, Scissors, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface RelationPanelProps {
  relations: SourceRelationDraft[];
  setRelations: (relations: SourceRelationDraft[]) => void;
}

function newRelation(): SourceRelationDraft {
  return {
    id: uuidv7(),
    referencedSourceTileId: "",
    referencedTitle: "",
    kind: 0,
    point: 0,
    offsetMs: 0,
    ordering: { primary: 1, point: 0, direction: 0 },
    durationKind: "subject",
    fixedDurationMs: null,
    splitPolicy: {
      kind: "unsplit",
      requiredTotalDurationMs: 30 * 60_000,
      minSegmentMs: null,
      maxSegmentMs: null,
    },
    correlationScope: 0,
    lifecycleFilter: 0,
    eligibleThroughRevision: 2_147_483_647,
    summaryPriority: 0,
  };
}

export function RelationPanel({ relations, setRelations }: RelationPanelProps) {
  const { t } = useTranslation();
  const [sources, setSources] = useState<SourceTileRead[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listSourceTiles(makeClient()).then((result) => {
      if (!active) return;
      if (result.ok) setSources(result.data);
      else setLoadError(result.error.message);
    });
    return () => {
      active = false;
    };
  }, []);

  const update = (id: string, patch: Partial<SourceRelationDraft>) =>
    setRelations(
      relations.map((relation) => (relation.id === id ? { ...relation, ...patch } : relation)),
    );

  return (
    <Stack gap="md" p="md">
      <FormRow icon={<Network className="h-4 w-4" aria-hidden />}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t("quickCreate.panel.relations.heading")}</span>
          <span className="text-xs text-foreground-muted">
            {t("quickCreate.panel.relations.description")}
          </span>
        </div>
      </FormRow>
      {loadError ? <Alert color="red">{loadError}</Alert> : null}
      {relations.map((relation, index) => (
        <Stack key={relation.id} gap="xs" p="sm" className="rounded-lg border border-border">
          <Group justify="space-between">
            <Text fw={600} size="xs">
              {t("quickCreate.panel.relations.relationIndexLabel", { index: index + 1 })}
            </Text>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={t("quickCreate.panel.relations.removeRelationAria")}
              onClick={() => setRelations(relations.filter((item) => item.id !== relation.id))}
            >
              <Trash2 size={15} />
            </ActionIcon>
          </Group>
          <FormRow icon={<ExternalLink className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.relations.referencedSourceLabel")}</span>
              <Select
                searchable
                value={relation.referencedSourceTileId || null}
                data={sources.map((source) => ({
                  value: source.source_tile_id,
                  label: source.title,
                }))}
                onChange={(value) => {
                  const source = sources.find((item) => item.source_tile_id === value);
                  update(relation.id, {
                    referencedSourceTileId: value ?? "",
                    referencedTitle: source?.title ?? "",
                  });
                }}
              />
            </div>
          </FormRow>

          <FormRow icon={<Network className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.relations.relationKindLabel")}</span>
              <Select
                value={String(relation.kind)}
                data={[
                  { value: "0", label: t("quickCreate.panel.relations.kindInside") },
                  { value: "1", label: t("quickCreate.panel.relations.kindBefore") },
                  { value: "2", label: t("quickCreate.panel.relations.kindAfter") },
                  { value: "3", label: t("quickCreate.panel.relations.kindStartsAt") },
                  { value: "4", label: t("quickCreate.panel.relations.kindEndsAt") },
                  { value: "5", label: t("quickCreate.panel.relations.kindSameSpan") },
                  { value: "6", label: t("quickCreate.panel.relations.kindSameDuration") },
                ]}
                onChange={(value) => update(relation.id, { kind: Number(value) })}
              />
            </div>
          </FormRow>

          <FormRow icon={<MoveHorizontal className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.relations.offsetPriorityLabel")}</span>
              <Group grow>
                <NumberInput
                  label={t("quickCreate.panel.relations.offsetMinutesLabel")}
                  value={relation.offsetMs / 60_000}
                  onChange={(value) => update(relation.id, { offsetMs: (Number(value) || 0) * 60_000 })}
                />
                <NumberInput
                  label={t("quickCreate.panel.relations.priorityLabel")}
                  value={relation.summaryPriority}
                  onChange={(value) => update(relation.id, { summaryPriority: Number(value) || 0 })}
                />
              </Group>
            </div>
          </FormRow>

          <FormRow icon={<Clock className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.relations.durationLabel")}</span>
              <Select
                value={relation.durationKind}
                data={[
                  { value: "subject", label: t("quickCreate.panel.relations.durationSubject") },
                  { value: "reference", label: t("quickCreate.panel.relations.durationReference") },
                  { value: "fixed", label: t("quickCreate.panel.relations.durationFixed") },
                ]}
                onChange={(value) =>
                  update(relation.id, {
                    durationKind: (value ?? "subject") as SourceRelationDraft["durationKind"],
                  })
                }
              />
            </div>
          </FormRow>

          {relation.durationKind === "fixed" ? (
            <FormRow icon={<Clock className="h-4 w-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">{t("quickCreate.panel.relations.fixedMinutesLabel")}</span>
                <NumberInput
                  min={1}
                  value={(relation.fixedDurationMs ?? 0) / 60_000}
                  onChange={(value) =>
                    update(relation.id, { fixedDurationMs: (Number(value) || 0) * 60_000 })
                  }
                />
              </div>
            </FormRow>
          ) : null}

          <FormRow icon={<Scissors className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.relations.allocationSplitLabel")}</span>
              <Select
                value={relation.splitPolicy.kind}
                data={[
                  { value: "unsplit", label: t("quickCreate.panel.relations.splitUnsplit") },
                  { value: "split", label: t("quickCreate.panel.relations.splitMultiple") },
                ]}
                onChange={(value) =>
                  update(relation.id, {
                    splitPolicy: {
                      ...relation.splitPolicy,
                      kind: (value ?? "unsplit") as "unsplit" | "split",
                    },
                  })
                }
              />
            </div>
          </FormRow>

          <FormRow icon={<Clock className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{t("quickCreate.panel.relations.totalAllocationLabel")}</span>
              <NumberInput
                min={1}
                value={relation.splitPolicy.requiredTotalDurationMs / 60_000}
                onChange={(value) =>
                  update(relation.id, {
                    splitPolicy: {
                      ...relation.splitPolicy,
                      requiredTotalDurationMs: (Number(value) || 1) * 60_000,
                    },
                  })
                }
              />
            </div>
          </FormRow>

          {relation.splitPolicy.kind === "split" ? (
            <FormRow icon={<Scissors className="h-4 w-4" aria-hidden />} className="items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">{t("quickCreate.panel.relations.splitSettingsLabel")}</span>
                <Group grow>
                  <NumberInput
                    label={t("quickCreate.panel.relations.minSegmentLabel")}
                    min={1}
                    value={(relation.splitPolicy.minSegmentMs ?? 0) / 60_000}
                    onChange={(value) =>
                      update(relation.id, {
                        splitPolicy: {
                          ...relation.splitPolicy,
                          minSegmentMs: (Number(value) || 1) * 60_000,
                        },
                      })
                    }
                  />
                  <NumberInput
                    label={t("quickCreate.panel.relations.maxSegmentLabel")}
                    min={1}
                    value={(relation.splitPolicy.maxSegmentMs ?? 0) / 60_000}
                    onChange={(value) =>
                      update(relation.id, {
                        splitPolicy: {
                          ...relation.splitPolicy,
                          maxSegmentMs: (Number(value) || 1) * 60_000,
                        },
                      })
                    }
                  />
                </Group>
              </div>
            </FormRow>
          ) : null}
        </Stack>
      ))}
      <Button
        variant="outline"
        leftSection={<Plus size={15} />}
        onClick={() => setRelations([...relations, newRelation()])}
      >
        {t("quickCreate.panel.relations.addRelation")}
      </Button>
    </Stack>
  );
}
