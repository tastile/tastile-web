"use client";

import { MiniCalendar } from "@/components/ui/MiniCalendar";
import { cn } from "@/lib/utils/cn";

// ─────────────────────────────────────────────
// Calendar Side Panel
// ─────────────────────────────────────────────
interface CalendarSidePanelProps {
  /** 選択中の日付 (YYYY-MM-DD) */
  anchor: string;
  /** 日付クリック時 */
  onSelectDate?: (date: string) => void;
  /** 表示するブロック種別フィルター (仮置き、将来機能) */
  visibleTypes?: Set<string>;
  onToggleType?: (type: string) => void;
}

const BLOCK_TYPES = [
  { key: "work", label: "Work", color: "bg-primary" },
  { key: "break", label: "Break", color: "bg-warning" },
  { key: "fixed", label: "Fixed", color: "bg-success" },
  { key: "done", label: "Done", color: "bg-foreground-lighter" },
] as const;

export function CalendarSidePanel({
  anchor,
  onSelectDate,
  visibleTypes,
  onToggleType,
}: CalendarSidePanelProps) {
  const allVisible = !visibleTypes || visibleTypes.size === 0;

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* ミニカレンダー */}
      <MiniCalendar selected={anchor} onSelect={onSelectDate} />

      <div className="mx-3 h-px bg-border" />

      {/* カレンダー表示切り替え */}
      <div className="px-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Calendars
        </p>
        <ul className="flex flex-col gap-1">
          {BLOCK_TYPES.map(({ key, label, color }) => {
            const visible = allVisible || visibleTypes?.has(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onToggleType?.(key)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
                >
                  {/* チェックボックス風インジケーター */}
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                      visible
                        ? cn(color, "border-transparent")
                        : "border-border-strong bg-transparent",
                    )}
                  >
                    {visible && (
                      <svg
                        viewBox="0 0 10 8"
                        className="h-2 w-2 fill-none stroke-white stroke-2"
                        aria-hidden
                      >
                        <title>Visible</title>
                        <polyline points="1,4 3.5,6.5 9,1" />
                      </svg>
                    )}
                  </span>
                  <span className={cn("flex-1", !visible && "text-foreground-subtle")}>
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Timeline Side Panel
// ─────────────────────────────────────────────
type TimelineScale = "day" | "week" | "month" | "custom";

interface TimelineSidePanelProps {
  anchor: string;
  scale: TimelineScale;
  onSelectDate?: (date: string) => void;
  onScaleChange?: (scale: TimelineScale) => void;
}

const SCALES: { key: TimelineScale; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "custom", label: "Custom" },
];

export function TimelineSidePanel({
  anchor,
  scale,
  onSelectDate,
  onScaleChange,
}: TimelineSidePanelProps) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* ミニカレンダー */}
      <MiniCalendar
        selected={anchor}
        onSelect={(date) => {
          onSelectDate?.(date);
          // 日付クリック → custom range の start に設定
          onScaleChange?.("custom");
        }}
      />

      <div className="mx-3 h-px bg-border" />

      {/* 表示スケール */}
      <div className="px-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Scale
        </p>
        <div className="flex flex-col gap-0.5">
          {SCALES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onScaleChange?.(key)}
              className={cn(
                "flex h-8 items-center rounded-md px-2.5 text-sm transition-colors",
                scale === key
                  ? "bg-surface-2 font-medium text-foreground"
                  : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
              )}
              aria-pressed={scale === key}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
