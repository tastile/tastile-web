// src/components/schedule/ScheduleToolbar.tsx
"use client";

import { ActionIcon, Button, SegmentedControl } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DisplayMode, ScheduleView } from "./useTimelineState";

const VIEW_OPTIONS: { value: ScheduleView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "agenda", label: "Agenda" },
];

const MODE_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: "scope", label: "Scope" },
  { value: "around", label: "Around" },
  { value: "future", label: "Future" },
];

function formatAnchor(view: ScheduleView, anchor: string): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  if (view === "day" || view === "agenda") {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  if (view === "week") {
    const start = new Date(d);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  if (view === "month") {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
}

function modeLabel(view: ScheduleView, mode: DisplayMode): string | null {
  if (mode === "scope") return null;
  if (mode === "around") {
    if (view === "day") return "Today · ±12h";
    if (view === "week") return "Today · ±3d";
    if (view === "month") return "Today · ±15d";
    return "Today";
  }
  if (view === "day") return "From now · 24h";
  if (view === "week") return "From now · 7d";
  if (view === "month") return "From now · 31d";
  return "From now";
}

export interface ScheduleToolbarProps {
  view: ScheduleView;
  mode: DisplayMode;
  anchor: string;
  navDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (v: ScheduleView) => void;
  onModeChange: (m: DisplayMode) => void;
}

export function ScheduleToolbar({
  view,
  mode,
  anchor,
  navDisabled,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onModeChange,
}: ScheduleToolbarProps) {
  const titlePrefix = modeLabel(view, mode);
  return (
    <div className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 bg-surface-0 px-4">
      <ActionIcon
        type="button"
        variant="subtle"
        size="sm"
        onClick={onPrev}
        aria-label="Previous"
        disabled={navDisabled}
        data-testid="cal-prev"
        className="rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </ActionIcon>
      <h2 className="font-mono text-sm text-foreground" data-testid="cal-title">
        {titlePrefix ? (
          <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
            {titlePrefix}
          </span>
        ) : null}
        {formatAnchor(view, anchor)}
      </h2>
      <ActionIcon
        type="button"
        variant="subtle"
        size="sm"
        onClick={onNext}
        aria-label="Next"
        disabled={navDisabled}
        data-testid="cal-next"
        className="rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </ActionIcon>
      <Button
        type="button"
        variant="subtle"
        size="compact-sm"
        onClick={onToday}
        disabled={navDisabled}
        data-testid="cal-today"
        className="ml-1 rounded px-2 py-0.5 text-[11px] font-medium text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
      >
        Today
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {view !== "month" && view !== "year" && view !== "agenda" && (
          <SegmentedControl
            size="xs"
            radius="md"
            withItemsBorders={false}
            value={mode}
            onChange={(v) => onModeChange(v as DisplayMode)}
            data={MODE_OPTIONS.map((m) => ({
              value: m.value,
              label: <span data-testid={`cal-mode-${m.value}`}>{m.label}</span>,
            }))}
            styles={{
              root: { backgroundColor: "var(--surface-1)" },
              indicator: { backgroundColor: "var(--surface-2)" },
              label: { color: "var(--foreground)" },
            }}
            data-testid="cal-mode-switcher"
          />
        )}
        <SegmentedControl
          size="xs"
          radius="md"
          withItemsBorders={false}
          value={view}
          onChange={(v) => onViewChange(v as ScheduleView)}
          data={VIEW_OPTIONS.map((v) => ({
            value: v.value,
            label: <span data-testid={`cal-view-${v.value}`}>{v.label}</span>,
          }))}
          styles={{
            root: { backgroundColor: "var(--surface-1)" },
            indicator: { backgroundColor: "var(--surface-2)" },
            label: { color: "var(--foreground)" },
          }}
          data-testid="cal-view-switcher"
        />
      </div>
    </div>
  );
}
