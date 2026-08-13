"use client";

import type { SourceAuthoringSlice, TimeSlice } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { NumberInput, Select, SimpleGrid, Stack, TagsInput, Text, Tooltip } from "@mantine/core";
import { Clock, Globe, Scissors, XCircle } from "lucide-react";

interface SourceWindowPanelProps {
  source: SourceAuthoringSlice;
  time: TimeSlice;
  setField: (path: string, value: unknown) => void;
}

const minutes = (value: number | string) => Math.max(0, Number(value) || 0) * 60_000;
const asMinutes = (value: number | null) => (value === null ? "" : value / 60_000);

export function SourceWindowPanel({ source, time, setField }: SourceWindowPanelProps) {
  return (
    <Stack gap="md" p="md">
      <FormRow icon={null}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">配置可能時間と所要時間</span>
          <span className="text-xs text-foreground-muted">
            固定用途ではなく、すべてのSourceに共通する時間制約です。
          </span>
        </div>
      </FormRow>

      <FormRow icon={<Clock className="h-4 w-4" aria-hidden />} className="items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">必要時間</span>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              label="最小（分）"
              min={1}
              value={asMinutes(time.durationMinMax.minMs)}
              onChange={(value) => setField("time.durationMinMax.minMs", minutes(value))}
            />
            <NumberInput
              label="最大（分）"
              min={1}
              value={asMinutes(time.durationMinMax.maxMs)}
              onChange={(value) => setField("time.durationMinMax.maxMs", minutes(value))}
            />
          </SimpleGrid>
        </div>
      </FormRow>

      <FormRow icon={<Clock className="h-4 w-4" aria-hidden />} className="items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">希望時間</span>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              label="最小（分）"
              min={0}
              value={asMinutes(source.preferredDurationMinMax.minMs)}
              onChange={(value) =>
                setField("source.preferredDurationMinMax.minMs", value === "" ? null : minutes(value))
              }
            />
            <NumberInput
              label="最大（分）"
              min={0}
              value={asMinutes(source.preferredDurationMinMax.maxMs)}
              onChange={(value) =>
                setField("source.preferredDurationMinMax.maxMs", value === "" ? null : minutes(value))
              }
            />
          </SimpleGrid>
        </div>
      </FormRow>

      <FormRow icon={<Globe className="h-4 w-4" aria-hidden />} className="items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">ローカルUTCオフセット（分）</span>
          <NumberInput
            min={-840}
            max={840}
            value={source.offsetMin}
            onChange={(value) => setField("source.offsetMin", Number(value) || 0)}
          />
        </div>
      </FormRow>

      <FormRow icon={null}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">配置優先度</span>
          <NumberInput
            value={source.priority}
            onChange={(value) => setField("source.priority", Number(value) || 0)}
          />
        </div>
      </FormRow>

      <FormRow icon={<XCircle className="h-4 w-4" aria-hidden />} className="items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">除外日</span>
          <TagsInput
            description="YYYY-MM-DD。祝日・振替休日・特別日程など、このTileを生成しない日を指定。Enterで複数追加できます。"
            placeholder="2026-08-06"
            value={source.excludedDates}
            onChange={(value) => setField("source.excludedDates", value)}
          />
        </div>
      </FormRow>

      <FormRow icon={<Scissors className="h-4 w-4" aria-hidden />} className="items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">分割</span>
          <Tooltip label="not supported in this build" position="top" disabled={source.splitPolicy.kind !== 1}>
            <Select
              value={String(source.splitPolicy.kind)}
              data={[
                { value: "0", label: "分割しない" },
              ]}
              description="分割機能はこのビルドでは未対応です"
              onChange={(value) => {
                const num = Number(value) as 0 | 1 | 2;
                if (num === 0 || num === 1 || num === 2) {
                  setField("source.splitPolicy.kind", num);
                }
              }}
            />
          </Tooltip>
        </div>
      </FormRow>

      {source.splitPolicy.kind === 1 ? (
        <FormRow icon={<Scissors className="h-4 w-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">分割設定</span>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <NumberInput
                label="最小segment（分）"
                min={1}
                value={asMinutes(source.splitPolicy.minSegmentMs)}
                onChange={(value) =>
                  setField("source.splitPolicy.minSegmentMs", value === "" ? null : minutes(value))
                }
              />
              <NumberInput
                label="最大segment（分）"
                min={1}
                value={asMinutes(source.splitPolicy.maxSegmentMs)}
                onChange={(value) =>
                  setField("source.splitPolicy.maxSegmentMs", value === "" ? null : minutes(value))
                }
              />
              <NumberInput
                label="最大segment数"
                min={1}
                value={source.splitPolicy.maxSegments ?? ""}
                onChange={(value) =>
                  setField("source.splitPolicy.maxSegments", value === "" ? null : Number(value))
                }
              />
            </SimpleGrid>
          </div>
        </FormRow>
      ) : null}
    </Stack>
  );
}
