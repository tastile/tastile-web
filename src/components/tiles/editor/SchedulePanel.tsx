"use client";

/**
 * SchedulePanel — Recurring v4 "when" panel.
 *
 * v4 design (parity with `docs/tastile_tile_creation_panel_demo_v4.html`
 * `when` view, lines 184–187 + `calendarHtml`/`timeEditorHtml` at 204/208):
 *   1. null-card "日付・時間を指定しない" → clears span / whenMode="none"
 *   2. "日付" builder section: choice-tabs 1日 / 期間 / 参照範囲
 *   3. Calendar widget when mode is day or range
 *   4. Catalog item when mode is reference (static v1 gap: opens as detail panel later)
 *   5. "時間帯" builder section: 3-choice tab 終日 / 範囲 / 指定なし + hint
 *   6. HH:MM time pickers when timeOfDayMode === "range"
 *   7. Quick pills 6–10 / 9–18 / 18–24 that snap timeOfDay range
 *   8. Legacy Windows section is preserved at the bottom (edit entry from the
 *      base panel routes to "time" sub-panel, so dropping it would orphan the
 *      existing windows editor). It is NOT in v4 — a future pass relocates
 *      it into the when-condition panel as per v4 schema.
 *
 * The §3 Time FormPanel wrapper stays in the shell (QuickTileCreate). The
 * `allDay` toggle was removed: v4 expresses the same idea via `timeOfDayMode`
 * (all-day / range / unspecified). `time.span` continues to be the persistence
 * field; we derive its values from `whenMode` + the calendar inputs.
 */

import { Calendar, Folder, Plus, Tag, X } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/Button";
import { MiniCalendar } from "@/components/ui/MiniCalendar";
import {
  FormDivider,
  FormRow,
  RowInput,
  RowSegmented,
  SectionHeader,
} from "@/components/ui/form";
import type { Window } from "@/lib/domain/v1/window";
import type { WhenMode, TimeOfDayMode } from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";

import { type EditorLocale, isoToLocalDate } from "./date-utils";

const WHEN_MODE_OPTIONS: ReadonlyArray<{
  id: WhenMode;
  labelKey: string;
}> = [
  { id: "day", labelKey: "quickCreate.whenModeDay" },
  { id: "range", labelKey: "quickCreate.whenModeRange" },
  { id: "reference", labelKey: "quickCreate.whenModeReference" },
];

const TIME_OF_DAY_OPTIONS: ReadonlyArray<{
  id: TimeOfDayMode;
  labelKey: string;
}> = [
  { id: "all-day", labelKey: "quickCreate.timeOfDayAllDay" },
  { id: "range", labelKey: "quickCreate.timeOfDayRange" },
  { id: "unspecified", labelKey: "quickCreate.timeOfDayUnspecified" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const QUICK_RANGES: ReadonlyArray<{
  labelKey: string;
  start: string;
  end: string;
}> = [
  { labelKey: "quickCreate.quickMorning", start: "06:00", end: "10:00" },
  { labelKey: "quickCreate.quickMidday", start: "09:00", end: "18:00" },
  { labelKey: "quickCreate.quickNight", start: "18:00", end: "24:00" },
];

const WINDOW_KIND_OPTIONS = [
  { value: "0", label: "quickCreate.windowKindCalendar" },
  { value: "1", label: "quickCreate.windowKindLabelSpan" },
  { value: "2", label: "quickCreate.windowKindParentSpan" },
  { value: "3", label: "quickCreate.windowKindGap" },
] as const;

interface BuilderLabelProps {
  title: string;
  hint?: string;
}

function BuilderLabel({ title, hint }: BuilderLabelProps) {
  return (
    <div className="flex items-baseline gap-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
      <span>{title}</span>
      {hint ? <span className="font-normal normal-case tracking-normal">{hint}</span> : null}
    </div>
  );
}

interface ChoiceTabsProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ id: T; labelKey: string }>;
  testIdPrefix: string;
  t: (key: string) => string;
}

function ChoiceTabs<T extends string>({
  value,
  onChange,
  options,
  testIdPrefix,
  t,
}: ChoiceTabsProps<T>) {
  return (
    <div
      role="radiogroup"
      className="flex flex-wrap gap-1"
      data-testid={`${testIdPrefix}-choice-tabs`}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`${testIdPrefix}-${opt.id}`}
            onClick={() => onChange(opt.id)}
            className={cn(
              "min-h-[32px] rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "border-accent/40 bg-accent-soft text-accent-ink"
                : "border-border bg-surface-0 text-foreground-muted hover:bg-surface-1",
            )}
          >
            {t(opt.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

interface NullCardProps {
  active: boolean;
  onActivate: () => void;
  title: string;
  sub: string;
  testId: string;
}

function NullCard({ active, onActivate, title, sub, testId }: NullCardProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onActivate}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border bg-surface-0 p-3 text-left transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
        active ? "border-accent/40 bg-accent-soft" : "border-border hover:bg-surface-1",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-3 w-3 shrink-0 rounded-full border-2",
          active ? "border-accent bg-accent" : "border-foreground-muted",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        <div className="text-[10px] text-foreground-muted">{sub}</div>
      </div>
    </button>
  );
}

function timeOfDayToSpanValues(
  mode: TimeOfDayMode,
  start: string,
  end: string,
): { start: string; end: string } {
  if (mode !== "range") return { start: "", end: "" };
  return { start, end };
}

/** Format YYYY-MM-DD picker value from a (possibly empty) ISO string. */
function isoToPicker(iso: string | null | undefined): string {
  return isoToLocalDate(iso ?? "");
}

interface TimeOfDayEditorProps {
  mode: TimeOfDayMode;
  start: string;
  end: string;
  onModeChange: (next: TimeOfDayMode) => void;
  onStartChange: (next: string) => void;
  onEndChange: (next: string) => void;
  onQuickPick: (start: string, end: string) => void;
  t: (key: string) => string;
}

function TimeOfDayEditor({
  mode,
  start,
  end,
  onModeChange,
  onStartChange,
  onEndChange,
  onQuickPick,
  t,
}: TimeOfDayEditorProps) {
  return (
    <div className="space-y-2">
      <BuilderLabel
        title={t("quickCreate.timeOfDayLabel")}
        hint={t("quickCreate.timeOfDayHint")}
      />
      <ChoiceTabs<TimeOfDayMode>
        value={mode}
        onChange={onModeChange}
        options={TIME_OF_DAY_OPTIONS}
        testIdPrefix="time-of-day"
        t={t}
      />
      {mode === "range" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1.5">
              <select
                aria-label={`${t("quickCreate.timeOfDayLabel")} start hour`}
                value={start.split(":")[0] ?? ""}
                onChange={(e) => onStartChange(`${e.target.value}:${start.split(":")[1] ?? "00"}`)}
                className="themed-datetime-input w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                data-testid="time-of-day-start-hour"
              >
                <option value="">--</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-foreground-muted">:</span>
              <select
                aria-label={`${t("quickCreate.timeOfDayLabel")} start minute`}
                value={start.split(":")[1] ?? ""}
                onChange={(e) => onStartChange(`${start.split(":")[0] ?? "00"}:${e.target.value}`)}
                className="themed-datetime-input w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                data-testid="time-of-day-start-minute"
              >
                <option value="">--</option>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <span aria-hidden="true" className="text-foreground-muted">→</span>
            <div className="flex flex-1 items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1.5">
              <select
                aria-label={`${t("quickCreate.timeOfDayLabel")} end hour`}
                value={end.split(":")[0] ?? ""}
                onChange={(e) => onEndChange(`${e.target.value}:${end.split(":")[1] ?? "00"}`)}
                className="themed-datetime-input w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                data-testid="time-of-day-end-hour"
              >
                <option value="">--</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-foreground-muted">:</span>
              <select
                aria-label={`${t("quickCreate.timeOfDayLabel")} end minute`}
                value={end.split(":")[1] ?? ""}
                onChange={(e) => onEndChange(`${end.split(":")[0] ?? "00"}:${e.target.value}`)}
                className="themed-datetime-input w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                data-testid="time-of-day-end-minute"
              >
                <option value="">--</option>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-1" data-testid="time-of-day-quick-row">
            {QUICK_RANGES.map((q) => (
              <button
                key={q.labelKey}
                type="button"
                onClick={() => onQuickPick(q.start, q.end)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px] font-semibold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                  start === q.start && end === q.end
                    ? "border-accent/40 bg-accent-soft text-accent-ink"
                    : "border-border bg-surface-0 text-foreground-muted hover:bg-surface-1",
                )}
                data-testid={`time-of-day-quick-${q.labelKey.split(".").pop()}`}
              >
                {t(q.labelKey)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface WindowRowProps {
  window: Window;
  index: number;
  onUpdate: (index: number, updater: (current: Window) => Window) => void;
  onRemove: (index: number) => void;
  t: (key: string) => string;
  locale: EditorLocale;
}

function WindowRow({ window, index, onUpdate, onRemove, t }: WindowRowProps) {
  const referenceKind = window.kind === 1 || window.kind === 2 || window.kind === 3;
  return (
    <div data-testid={`window-row-${index}`} className="space-y-2 border-l-2 border-surface-2 pl-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground-muted">
          {t("quickCreate.windowsTitle")} #{index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={t("quickCreate.windowRemove")}
          className="text-foreground-muted hover:text-danger focus:outline-hidden"
        >
          <X size={14} />
        </button>
      </div>
      <RowSegmented
        icon={Calendar}
        options={WINDOW_KIND_OPTIONS.map((opt) => ({
          value: opt.value,
          label: t(opt.label),
        }))}
        value={String(window.kind)}
        onChange={(value) => onUpdate(index, (w) => ({ ...w, kind: Number(value) }))}
      />
      <FormRow icon={<Calendar size={20} />}>
        <div className="grid w-full grid-cols-2 gap-2">
          <input
            type="datetime-local"
            aria-label={`${t("quickCreate.startAt")} (datetime)`}
            value={window.bounds.start ? window.bounds.start.slice(0, 16) : ""}
            onChange={(e) =>
              onUpdate(index, (w) => ({
                ...w,
                bounds: { ...w.bounds, start: e.target.value ? `${e.target.value}:00Z` : "" },
              }))
            }
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="datetime-local"
            aria-label={`${t("quickCreate.endAt")} (datetime)`}
            value={window.bounds.end ? window.bounds.end.slice(0, 16) : ""}
            onChange={(e) =>
              onUpdate(index, (w) => ({
                ...w,
                bounds: { ...w.bounds, end: e.target.value ? `${e.target.value}:00Z` : "" },
              }))
            }
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </FormRow>
      {referenceKind ? (
        <RowInput
          icon={Tag}
          placeholder={t("quickCreate.windowReferenceIdLabel")}
          value={window.referenceId ?? ""}
          onChange={(value) =>
            onUpdate(index, (w) => ({
              ...w,
              referenceId: value.trim() ? value : null,
            }))
          }
          ariaLabel={t("quickCreate.windowReferenceIdLabel")}
        />
      ) : null}
    </div>
  );
}

export interface SchedulePanelProps {
  time: {
    span: { start: string; end: string };
    whenMode: WhenMode;
    timeOfDayMode: TimeOfDayMode;
    timeOfDayStart: string;
    timeOfDayEnd: string;
    referenceId: string | null;
    referenceLabel: string;
  };
  windows: Window[];
  setField: (path: string, value: unknown) => void;
  updateWindow: (index: number, updater: (current: Window) => Window) => void;
  addWindow: () => void;
  removeWindow: (index: number) => void;
  locale: EditorLocale;
  t: (key: string) => string;
}

export function SchedulePanel({
  time,
  windows,
  setField,
  updateWindow,
  addWindow,
  removeWindow,
  locale: _locale,
  t,
}: SchedulePanelProps) {
  const startDay = isoToPicker(time.span.start);
  const endDay = isoToPicker(time.span.end);

  // Days to highlight as a range: every day from start to end inclusive.
  const highlightDays = useMemo<readonly string[] | undefined>(() => {
    if (time.whenMode !== "range" || !startDay || !endDay) return undefined;
    const start = new Date(startDay);
    const end = new Date(endDay);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
    const days: string[] = [];
    if (start <= end) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
      }
    } else {
      for (let d = new Date(end); d <= start; d.setDate(d.getDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
      }
    }
    return days;
  }, [time.whenMode, startDay, endDay]);

  function applyCalendarSelect(date: string) {
    if (time.whenMode === "day") {
      setField("time.span.start", date);
      setField("time.span.end", "");
      return;
    }
    if (time.whenMode === "range") {
      // First click sets start, second click sets end (with swap if needed).
      if (!time.span.start || (time.span.start && time.span.end)) {
        setField("time.span.start", date);
        setField("time.span.end", "");
      } else {
        const cur = time.span.start;
        const finalStart = cur <= date ? cur : date;
        const finalEnd = cur <= date ? date : cur;
        setField("time.span.start", finalStart);
        setField("time.span.end", finalEnd);
      }
    }
  }

  function applyWhenMode(next: WhenMode) {
    setField("time.whenMode", next);
    if (next === "none") {
      setField("time.span.start", "");
      setField("time.span.end", "");
      setField("time.timeOfDayMode", "unspecified");
      setField("time.timeOfDayStart", "");
      setField("time.timeOfDayEnd", "");
    }
    if (next === "day") {
      setField("time.span.end", "");
    }
    if (next === "reference") {
      setField("time.span.start", "");
      setField("time.span.end", "");
    }
  }

  function applyTimeOfDayMode(next: TimeOfDayMode) {
    setField("time.timeOfDayMode", next);
    if (next === "range") {
      const cur = timeOfDayToSpanValues(next, time.timeOfDayStart || "09:00", time.timeOfDayEnd || "18:00");
      setField("time.timeOfDayStart", cur.start);
      setField("time.timeOfDayEnd", cur.end);
    } else {
      setField("time.timeOfDayStart", "");
      setField("time.timeOfDayEnd", "");
    }
  }

  function applyQuickPick(start: string, end: string) {
    setField("time.timeOfDayMode", "range");
    setField("time.timeOfDayStart", start);
    setField("time.timeOfDayEnd", end);
  }

  return (
    <>
      <NullCard
        active={time.whenMode === "none"}
        onActivate={() => applyWhenMode("none")}
        title={t("quickCreate.whenNoneTitle")}
        sub={t("quickCreate.whenNoneSub")}
        testId="when-none-toggle"
      />

      <div className="space-y-2">
        <BuilderLabel title={t("quickCreate.whenDateLabel")} />
        <ChoiceTabs<WhenMode>
          value={time.whenMode}
          onChange={applyWhenMode}
          options={WHEN_MODE_OPTIONS}
          testIdPrefix="when-mode"
          t={t}
        />
      </div>

      {time.whenMode === "day" || time.whenMode === "range" ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface-0 p-3" data-testid="when-calendar">
          <MiniCalendar
            selected={startDay || undefined}
            onSelect={applyCalendarSelect}
            highlight={highlightDays ?? (startDay ? [startDay] : [])}
          />
          <div className="flex flex-wrap gap-1" data-testid="when-calendar-quick-row">
            {[
              { id: "today", labelKey: "quickCreate.calendarToday", days: 0 },
              { id: "tomorrow", labelKey: "quickCreate.calendarTomorrow", days: 1 },
              { id: "thisWeek", labelKey: "quickCreate.calendarThisWeek", days: 7 },
            ].map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  const base = new Date();
                  base.setHours(0, 0, 0, 0);
                  const start = new Date(base);
                  if (q.days === 1) start.setDate(start.getDate() + 1);
                  if (q.days === 7) {
                    setField("time.span.start", base.toISOString().slice(0, 10));
                    const end = new Date(base);
                    end.setDate(end.getDate() + 6);
                    setField("time.span.end", end.toISOString().slice(0, 10));
                    if (time.whenMode === "day") applyWhenMode("range");
                    return;
                  }
                  setField("time.span.start", start.toISOString().slice(0, 10));
                  setField("time.span.end", "");
                }}
                className="rounded-full border border-border bg-surface-0 px-3 py-1 text-[10px] font-semibold text-foreground-muted hover:bg-surface-1"
                data-testid={`when-calendar-quick-${q.id}`}
              >
                {t(q.labelKey)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {time.whenMode === "reference" ? (
        <div data-testid="when-reference-catalog" className="flex items-center gap-3 rounded-lg border border-border bg-surface-0 p-3">
          <Folder size={20} className="shrink-0 text-foreground-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">
              {t("quickCreate.referenceRangeTitle")}
            </div>
            <div className="text-[10px] text-foreground-muted">
              {t("quickCreate.referenceRangeSub")}
            </div>
          </div>
          <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
            {t("quickCreate.referenceRangeBadge")}
          </span>
        </div>
      ) : null}

      {time.whenMode !== "none" ? (
        <FormDivider />
      ) : null}

      {time.whenMode !== "none" ? (
        <TimeOfDayEditor
          mode={time.timeOfDayMode}
          start={time.timeOfDayStart}
          end={time.timeOfDayEnd}
          onModeChange={applyTimeOfDayMode}
          onStartChange={(v) => setField("time.timeOfDayStart", v)}
          onEndChange={(v) => setField("time.timeOfDayEnd", v)}
          onQuickPick={applyQuickPick}
          t={t}
        />
      ) : null}

      <FormDivider />
      <SectionHeader icon={Calendar} title={t("quickCreate.windowsNavTitle")} />
      {windows.map((w, i) => (
        <WindowRow
          key={w.id}
          window={w}
          index={i}
          onUpdate={updateWindow}
          onRemove={removeWindow}
          t={t}
          locale={_locale}
        />
      ))}
      <Button
        type="button"
        size="small"
        variant="default"
        rounded
        iconLeft={<Plus size={12} aria-hidden="true" />}
        onClick={addWindow}
      >
        {t("quickCreate.windowsAdd")}
      </Button>
    </>
  );
}
