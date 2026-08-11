// src/components/schedule/ScheduleToolbar.tsx
"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { ActionIcon, Button, SegmentedControl } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DisplayMode, ScheduleView } from "./useTimelineState";

const VIEW_OPTIONS: { value: ScheduleView; labelKey: string }[] = [
  { value: "day", labelKey: "timeline.day" },
  { value: "week", labelKey: "timeline.week" },
  { value: "month", labelKey: "timeline.month" },
  { value: "year", labelKey: "timeline.year" },
  { value: "agenda", labelKey: "timeline.agenda" },
];

const MODE_OPTIONS: { value: DisplayMode; labelKey: string }[] = [
  { value: "scope", labelKey: "timeline.scope" },
  { value: "around", labelKey: "timeline.around" },
  { value: "future", labelKey: "timeline.future" },
];

function formatAnchor(view: ScheduleView, anchor: string, locale: string): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  const dateLocale = locale === "zh-CN" ? "zh-CN" : locale;
  if (view === "day" || view === "agenda") {
    return d.toLocaleDateString(dateLocale, {
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
    return `${start.toLocaleDateString(dateLocale, { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  if (view === "month") {
    return d.toLocaleDateString(dateLocale, { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleDateString(dateLocale, { year: "numeric", timeZone: "UTC" });
}

function modeLabel(mode: DisplayMode, t: (key: string) => string): string | null {
  if (mode === "scope") return null;
  return t(mode === "around" ? "timeline.around" : "timeline.future");
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
  const { t, locale } = useTranslation();
  const titlePrefix = modeLabel(mode, t);
  return (
    <div className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 bg-surface-0 px-4">
      <ActionIcon
        type="button"
        variant="subtle"
        size="sm"
        onClick={onPrev}
        aria-label={t("timeline.previous")}
        disabled={navDisabled}
        data-testid="cal-prev"
        className="rounded-sm p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </ActionIcon>
      <h2 className="font-mono text-sm text-foreground" data-testid="cal-title">
        {titlePrefix ? (
          <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
            {titlePrefix}
          </span>
        ) : null}
        {formatAnchor(view, anchor, locale)}
      </h2>
      <ActionIcon
        type="button"
        variant="subtle"
        size="sm"
        onClick={onNext}
        aria-label={t("timeline.next")}
        disabled={navDisabled}
        data-testid="cal-next"
        className="rounded-sm p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
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
        radius="sm"
        className="ml-1 rounded-sm px-2 py-0.5 text-[11px] font-medium text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
      >
        {t("timeline.today")}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {view !== "month" && view !== "year" && view !== "agenda" && (
          <SegmentedControl
            size="xs"
            radius="sm"
            withItemsBorders={false}
            value={mode}
            onChange={(v) => onModeChange(v as DisplayMode)}
            data={MODE_OPTIONS.map((m) => ({
              value: m.value,
              label: <span data-testid={`cal-mode-${m.value}`}>{t(m.labelKey)}</span>,
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
          radius="sm"
          withItemsBorders={false}
          value={view}
          onChange={(v) => onViewChange(v as ScheduleView)}
          data={VIEW_OPTIONS.map((v) => ({
            value: v.value,
            label: <span data-testid={`cal-view-${v.value}`}>{t(v.labelKey)}</span>,
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
