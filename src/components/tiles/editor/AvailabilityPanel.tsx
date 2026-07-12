"use client";

import type { FloatingLabel } from "./floating-schedule";
import { LabelSpanPicker } from "./LabelSpanPicker";

export function AvailabilityPanel({
  label,
  onChange,
}: {
  label: FloatingLabel | null;
  onChange: (label: FloatingLabel | null) => void;
}) {
  return (
    <section className="space-y-2">
      <LabelSpanPicker value={label} onChange={onChange} />
      <p className="text-xs text-foreground-muted">
        選んだ期間の中で、必要時間を満たせる空き時間へ配置します。
      </p>
    </section>
  );
}
