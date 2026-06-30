"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { MiniCalendar } from "@/components/ui/MiniCalendar";
import type { DisplayMode } from "@/lib/calendar/layout";
import { useProjects } from "@/lib/hooks/use-projects";
import { cn } from "@/lib/utils/cn";

type CalendarSidePanelView = "day" | "week" | "month" | "year" | "list";

// ─────────────────────────────────────────────
// Calendar Side Panel
// ─────────────────────────────────────────────
interface CalendarSidePanelProps {
  /** 選択中の日付 (YYYY-MM-DD) */
  anchor: string;
  /** 現在表示中のビュー。範囲ハイライト判定に使う。 */
  view?: CalendarSidePanelView;
  /** Timeline の表示モード。網掛け範囲の調整に使う。 */
  mode?: DisplayMode;
  /** 日付クリック時 */
  onSelectDate?: (date: string) => void;
}

// anchor (YYYY-MM-DD) と view から、ミニカレンダーで網掛けする
// 日付リストを返す。Day / List ビューは selected 単体で十分、Year
// ビューは日数が多すぎるため網掛けしない方針。
//
// DisplayMode (around / future) では「範囲が前後/未来に伸びる」が
// ミニカレンダーの網掛けは日単位でしか意味を持たないため,
//   around → 今日のみ (current position indicator)
//   future → 今日 ~ 範囲末日
//   scope  → 既存のスコープ網掛け
// と落とし込む。
function getHighlightDates(
  view: CalendarSidePanelView | undefined,
  mode: DisplayMode | undefined,
  anchor: string,
): string[] | undefined {
  if (!view) return undefined;
  if (view === "year") return undefined;
  if (mode === "around") {
    // Range straddles boundaries; just mark "today" so the user can
    // visually anchor on it.
    return [anchor];
  }
  if (mode === "future") {
    // From now until end of forward-scope range.
    const d = new Date(`${anchor}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return undefined;
    const dayMs = 24 * 60 * 60 * 1000;
    const out: string[] = [anchor];
    const days = view === "week" ? 7 : view === "month" ? 31 : 1;
    for (let i = 1; i < days; i++) {
      out.push(new Date(d.getTime() + i * dayMs).toISOString().slice(0, 10));
    }
    return out;
  }
  // mode === "scope" — existing per-view behavior.
  if (view === "day" || view === "list") return undefined;
  const d = new Date(`${anchor}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  if (view === "week") {
    const start = new Date(d);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // Sun = 0
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(start);
      x.setUTCDate(start.getUTCDate() + i);
      return x.toISOString().slice(0, 10);
    });
  }
  // view === "month"
  const _start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const out: string[] = [];
  for (let day = 1; day <= end.getUTCDate(); day++) {
    out.push(
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day)).toISOString().slice(0, 10),
    );
  }
  return out;
}

export function CalendarSidePanel({ anchor, view, mode, onSelectDate }: CalendarSidePanelProps) {
  const highlight = getHighlightDates(view, mode, anchor);
  // Around / future modes always anchor to today; the mini calendar
  // is read-only so the user can't pick a date the main view will
  // ignore anyway.
  const locked = mode === "around" || mode === "future";

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* ミニカレンダー */}
      <MiniCalendar
        selected={anchor}
        onSelect={onSelectDate}
        highlight={highlight}
        disabled={locked}
      />

      <div className="mx-3 h-px bg-border" />

      {/* Projects checkbox section */}
      <ProjectsCheckboxSection />
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

      <div className="mx-3 h-px bg-border" />

      {/* Projects checkbox section (shared with CalendarSidePanel) */}
      <ProjectsCheckboxSection />
    </div>
  );
}

// ─────────────────────────────────────────────
// Projects checkbox section — shared between calendar and timeline.
// State lives in the URL (?projects=u1,u2,...). Empty/unset means "all".
// ─────────────────────────────────────────────
function ProjectsCheckboxSection() {
  const { workspaces, loading } = useProjects();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const allIds = useMemo(() => workspaces.map((w) => w.id), [workspaces]);
  const selected = useMemo(() => {
    const raw = searchParams.get("projects");
    if (!raw) return new Set(allIds);
    return new Set(raw.split(",").filter(Boolean));
  }, [searchParams, allIds]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const params = new URLSearchParams(searchParams.toString());
    if (next.size === allIds.length) params.delete("projects");
    else params.set("projects", [...next].join(","));
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  if (loading) {
    return <div className="px-3 text-[10px] text-foreground-subtle">Loading projects…</div>;
  }
  if (workspaces.length === 0) return null;

  return (
    <div className="border-t border-border/40 px-3 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
          Projects
        </p>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {selected.size}/{workspaces.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {workspaces.map((w) => (
          <label
            key={w.id}
            className="flex cursor-pointer items-center gap-2 text-xs text-foreground-subtle hover:text-foreground"
          >
            <input
              type="checkbox"
              checked={selected.has(w.id)}
              onChange={() => toggle(w.id)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
              data-testid={`panel-project-${w.id}`}
            />
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: w.color ?? "#6b7280" }}
            />
            <span className="min-w-0 flex-1 truncate">{w.display_name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
