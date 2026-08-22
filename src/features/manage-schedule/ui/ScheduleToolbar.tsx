// src/components/schedule/ScheduleToolbar.tsx
"use client";

import { ActionIcon, Button, SegmentedControl } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/shared/i18n/use-translation";
import type { DisplayMode, ScheduleView } from "./useTimelineState";

export interface ScheduleToolbarProps {
  view: ScheduleView;
  mode: DisplayMode;
  anchor: string;
  effectiveAnchor: string;
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
  effectiveAnchor,
  navDisabled,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onModeChange,
}: ScheduleToolbarProps) {
  const { t } = useTranslation();

  const VIEW_OPTIONS = [
    { value: "day", label: t("panels.calendar.day") },
    { value: "week", label: t("panels.calendar.week") },
    { value: "month", label: t("panels.calendar.month") },
    { value: "year", label: t("panels.calendar.year") },
    { value: "agenda", label: t("panels.calendar.agenda") },
  ] as const;

  const MODE_OPTIONS = [
    { value: "scope", label: t("scheduleToolbar.mode.scope") },
    { value: "around", label: t("scheduleToolbar.mode.around") },
    { value: "future", label: t("scheduleToolbar.mode.future") },
  ] as const;

  function formatAnchor(
    view: ScheduleView,
    anchor: string,
    mode: DisplayMode,
    effectiveAnchor: string,
  ): string {
    // For around/future modes the rendered grid uses `effectiveAnchor`
    // (= today's local date), not the URL `anchor`. Title text has to
    // mirror the grid or it shows a stale "Aug 9 – Aug 15" header over
    // an "Aug 12 – Aug 18" future-mode view.
    const displayAnchor = mode === "scope" ? anchor : effectiveAnchor;
    const d = new Date(`${displayAnchor}T00:00:00Z`);
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
      if (mode === "around" || mode === "future") {
        const start = new Date(d);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 6);
        return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
      }
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
      if (view === "day") return t("scheduleToolbar.mode.todayAround12h");
      if (view === "week") return t("scheduleToolbar.mode.todayAround3d");
      if (view === "month") return t("scheduleToolbar.mode.todayAround15d");
      return t("scheduleToolbar.mode.today");
    }
    if (view === "day") return t("scheduleToolbar.mode.fromNow24h");
    if (view === "week") return t("scheduleToolbar.mode.fromNow7d");
    if (view === "month") return t("scheduleToolbar.mode.fromNow31d");
    return t("scheduleToolbar.mode.fromNow");
  }

  const titlePrefix = modeLabel(view, mode);
  return (
    <div className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 bg-surface-0 px-4">
      <ActionIcon
        type="button"
        variant="subtle"
        size="sm"
        onClick={onPrev}
        aria-label={t("common.back")}
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
        {formatAnchor(view, anchor, mode, effectiveAnchor)}
      </h2>
      <ActionIcon
        type="button"
        variant="subtle"
        size="sm"
        onClick={onNext}
        aria-label={t("scheduleToolbar.next")}
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
        {t("scheduleToolbar.today")}
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
