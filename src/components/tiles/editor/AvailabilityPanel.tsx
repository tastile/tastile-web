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
        Place into available time within the selected label span that satisfies the required time.
      </p>
    </section>
  );
}
