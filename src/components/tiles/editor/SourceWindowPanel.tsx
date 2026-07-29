"use client";

import type { SourceAuthoringSlice, TimeSlice } from "@/lib/stores/quick-create-store";
import { NumberInput, Select, SimpleGrid, Stack, TagsInput, Text } from "@mantine/core";

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
      <div>
        <Text fw={600} size="sm">
          配置可能時間と所要時間
        </Text>
        <Text c="dimmed" size="xs">
          固定用途ではなく、すべてのSourceに共通する時間制約です。
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <NumberInput
          label="必要時間 最小（分）"
          min={1}
          value={asMinutes(time.durationMinMax.minMs)}
          onChange={(value) => setField("time.durationMinMax.minMs", minutes(value))}
        />
        <NumberInput
          label="必要時間 最大（分）"
          min={1}
          value={asMinutes(time.durationMinMax.maxMs)}
          onChange={(value) => setField("time.durationMinMax.maxMs", minutes(value))}
        />
        <NumberInput
          label="希望時間 最小（分）"
          min={0}
          value={asMinutes(source.preferredDurationMinMax.minMs)}
          onChange={(value) =>
            setField("source.preferredDurationMinMax.minMs", value === "" ? null : minutes(value))
          }
        />
        <NumberInput
          label="希望時間 最大（分）"
          min={0}
          value={asMinutes(source.preferredDurationMinMax.maxMs)}
          onChange={(value) =>
            setField("source.preferredDurationMinMax.maxMs", value === "" ? null : minutes(value))
          }
        />
        <NumberInput
          label="ローカルUTCオフセット（分）"
          min={-840}
          max={840}
          value={source.offsetMin}
          onChange={(value) => setField("source.offsetMin", Number(value) || 0)}
        />
        <NumberInput
          label="配置優先度"
          value={source.priority}
          onChange={(value) => setField("source.priority", Number(value) || 0)}
        />
      </SimpleGrid>

      <TagsInput
        label="除外日"
        description="YYYY-MM-DD。祝日・振替休日・特別日程など、このTileを生成しない日を指定。Enterで複数追加できます。"
        placeholder="2026-08-06"
        value={source.excludedDates}
        onChange={(value) => setField("source.excludedDates", value)}
      />

      <Select
        label="分割"
        value={String(source.splitPolicy.kind)}
        data={[
          { value: "0", label: "分割しない" },
          { value: "1", label: "複数segmentへ分割可能" },
        ]}
        onChange={(value) => setField("source.splitPolicy.kind", Number(value) as 0 | 1)}
      />
      {source.splitPolicy.kind === 1 ? (
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
      ) : null}
    </Stack>
  );
}
