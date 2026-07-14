"use client";

import { NumberInput } from "@mantine/core";
import { Timer } from "lucide-react";

const MIN_MINUTES = 5;

export function RequiredTimePanel({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="block space-y-1">
      <span className="flex items-center gap-1.5 text-sm text-foreground">
        <Timer size={14} aria-hidden className="text-foreground-muted" />
        必要時間
      </span>
      <NumberInput
        aria-label="必要時間（分）"
        min={MIN_MINUTES}
        step={5}
        value={minutes}
        onChange={(value) => onChange(Math.max(MIN_MINUTES, Number(value) || MIN_MINUTES))}
        suffix=" 分"
        size="xs"
        styles={{
          input: { backgroundColor: "var(--surface-2)" },
        }}
      />
      <p className="text-xs text-foreground-muted">
        実際の開始・終了時刻は、空き時間からあとで決まります。
      </p>
    </div>
  );
}
