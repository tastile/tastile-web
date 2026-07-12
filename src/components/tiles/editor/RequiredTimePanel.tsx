"use client";

export function RequiredTimePanel({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-foreground">必要時間</span>
      <div className="flex items-center gap-2">
        <input
          aria-label="必要時間（分）"
          type="number"
          min={5}
          step={5}
          value={minutes}
          onChange={(event) => onChange(Math.max(5, Number(event.target.value) || 5))}
          className="w-24 rounded-md bg-surface-2 px-3 py-2 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <span className="text-sm text-foreground-muted">分</span>
      </div>
      <p className="text-xs text-foreground-muted">
        実際の開始・終了時刻は、空き時間からあとで決まります。
      </p>
    </label>
  );
}
