"use client";

import { type SourceTileRead, listSourceTiles } from "@/shared/api/v1/source-tiles";
import { makeClient } from "@/shared/api/v1/submit";
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
          <span className="text-xs font-medium">参照関係</span>
          <span className="text-xs text-foreground-muted">
            両端が対等なSource間の関係を定義します。関係の向きが便宜上の入れ子表示を決めます。
          </span>
        </div>
      </FormRow>
      {loadError ? <Alert color="red">{loadError}</Alert> : null}
      {relations.map((relation, index) => (
        <Stack key={relation.id} gap="xs" p="sm" className="rounded-lg border border-border">
          <Group justify="space-between">
            <Text fw={600} size="xs">
              関係 {index + 1}
            </Text>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label="関係を削除"
              onClick={() => setRelations(relations.filter((item) => item.id !== relation.id))}
            >
              <Trash2 size={15} />
            </ActionIcon>
          </Group>
          <FormRow icon={<ExternalLink className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">参照するSource</span>
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
              <span className="text-xs font-medium">関係</span>
              <Select
                value={String(relation.kind)}
                data={[
                  { value: "0", label: "内側に配置 (INSIDE)" },
                  { value: "1", label: "前に配置 (BEFORE)" },
                  { value: "2", label: "後に配置 (AFTER)" },
                  { value: "3", label: "開始を揃える (STARTS_AT)" },
                  { value: "4", label: "終了を揃える (ENDS_AT)" },
                  { value: "5", label: "同じSpan (SAME_SPAN)" },
                  { value: "6", label: "同じ長さ (SAME_DURATION)" },
                ]}
                onChange={(value) => update(relation.id, { kind: Number(value) })}
              />
            </div>
          </FormRow>

          <FormRow icon={<MoveHorizontal className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">オフセット & 優先度</span>
              <Group grow>
                <NumberInput
                  label="オフセット（分）"
                  value={relation.offsetMs / 60_000}
                  onChange={(value) => update(relation.id, { offsetMs: (Number(value) || 0) * 60_000 })}
                />
                <NumberInput
                  label="表示優先度"
                  value={relation.summaryPriority}
                  onChange={(value) => update(relation.id, { summaryPriority: Number(value) || 0 })}
                />
              </Group>
            </div>
          </FormRow>

          <FormRow icon={<Clock className="h-4 w-4" aria-hidden />} className="items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">長さ</span>
              <Select
                value={relation.durationKind}
                data={[
                  { value: "subject", label: "このSourceの長さ" },
                  { value: "reference", label: "参照Sourceと同じ長さ" },
                  { value: "fixed", label: "固定の長さ" },
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
                <span className="text-xs font-medium">固定時間（分）</span>
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
              <span className="text-xs font-medium">割り当ての分割</span>
              <Select
                value={relation.splitPolicy.kind}
                data={[
                  { value: "unsplit", label: "分割しない" },
                  { value: "split", label: "複数Placementへ分割" },
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
              <span className="text-xs font-medium">割り当てる合計時間（分）</span>
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
                <span className="text-xs font-medium">分割設定</span>
                <Group grow>
                  <NumberInput
                    label="最小segment（分）"
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
                    label="最大segment（分）"
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
        関係を追加
      </Button>
    </Stack>
  );
}
