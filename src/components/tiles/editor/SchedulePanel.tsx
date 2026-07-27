"use client";

/**
 * SchedulePanel — Recurring v4 "when" panel.
 *
 * v4 design (parity with `docs/tastile_tile_creation_panel_demo_v4.html`
 * `when` view, lines 184–187 + `calendarHtml`/`timeEditorHtml` at 204/208):
 *   1. Null card "Do not specify a date or time" → clears span / whenMode="none"
 *   2. "Date" builder section: choice tabs day / range / reference range
 *   3. Calendar widget when mode is day or range
 *   4. Catalog item when mode is reference (static v1 gap: opens as detail panel later)
 *   5. "Time of day" builder section: 3-choice tab all day / range / unspecified + hint
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

import { ActionIcon, Button, SegmentedControl, Switch } from "@mantine/core";
import { DateTimePicker, TimeInput } from "@mantine/dates";
import { Calendar, Folder, Plus, Tag, X } from "lucide-react";

import { FormDivider, FormRow, RowInput, RowSegmented, SectionHeader } from "@/components/ui/form";
import { MiniCalendar } from "@/components/ui/MiniCalendar";
import type { Window } from "@/lib/domain/v1/window";
import type { TimeOfDayMode, WhenMode } from "@/lib/stores/quick-create-store";

import { type EditorLocale, isoToLocalDate } from "./date-utils";
import { SEGMENT_STYLES } from "./panel-styles";

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
    <SegmentedControl
      fullWidth
      size="sm"
      radius="md"
      withItemsBorders={false}
      value={value}
      onChange={(next) => onChange(next as T)}
      data={options.map((opt) => ({ value: opt.id, label: t(opt.labelKey) }))}
      styles={SEGMENT_STYLES}
      data-testid={`${testIdPrefix}-choice-tabs`}
    />
  );
}

interface NullCardProps {
  active: boolean;
  onActivate: (mode: WhenMode) => void;
  title: string;
  sub: string;
  testId: string;
}

function NullCard({ active, onActivate, title, sub, testId }: NullCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-0 p-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        <div className="text-[10px] text-foreground-muted">{sub}</div>
      </div>
      <Switch
        checked={active}
        onChange={(e) => onActivate(e.currentTarget.checked ? "none" : "day")}
        size="md"
        data-testid={testId}
      />
    </div>
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
      <BuilderLabel title={t("quickCreate.timeOfDayLabel")} hint={t("quickCreate.timeOfDayHint")} />
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
            <TimeInput
              aria-label={`${t("quickCreate.timeOfDayLabel")} start`}
              value={start || "09:00"}
              onChange={(e) => onStartChange(e.currentTarget.value)}
              size="xs"
              className="flex-1"
            />
            <span aria-hidden="true" className="text-foreground-muted">
              →
            </span>
            <TimeInput
              aria-label={`${t("quickCreate.timeOfDayLabel")} end`}
              value={end || "18:00"}
              onChange={(e) => onEndChange(e.currentTarget.value)}
              size="xs"
              className="flex-1"
            />
          </div>
          <div className="flex flex-wrap gap-1" data-testid="time-of-day-quick-row">
            {QUICK_RANGES.map((q) => (
              <Button
                key={q.labelKey}
                type="button"
                variant={start === q.start && end === q.end ? "light" : "subtle"}
                size="xs"
                onClick={() => onQuickPick(q.start, q.end)}
                data-testid={`time-of-day-quick-${q.labelKey.split(".").pop()}`}
              >
                {t(q.labelKey)}
              </Button>
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
        <ActionIcon
          variant="subtle"
          size="sm"
          type="button"
          onClick={() => onRemove(index)}
          aria-label={t("quickCreate.windowRemove")}
          className="text-foreground-muted hover:text-danger focus:outline-hidden"
        >
          <X size={14} />
        </ActionIcon>
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
          <DateTimePicker
            aria-label={`${t("quickCreate.startAt")} (datetime)`}
            value={window.bounds.start ? window.bounds.start : null}
            onChange={(value) =>
              onUpdate(index, (w) => ({
                ...w,
                bounds: { ...w.bounds, start: value ?? "" },
              }))
            }
            size="xs"
            valueFormat="MM/DD HH:mm"
            clearable
            popoverProps={{ withinPortal: false }}
          />
          <DateTimePicker
            aria-label={`${t("quickCreate.endAt")} (datetime)`}
            value={window.bounds.end ? window.bounds.end : null}
            onChange={(value) =>
              onUpdate(index, (w) => ({
                ...w,
                bounds: { ...w.bounds, end: value ?? "" },
              }))
            }
            size="xs"
            valueFormat="MM/DD HH:mm"
            clearable
            popoverProps={{ withinPortal: false }}
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
  // React Compiler memoizes this automatically; no manual `useMemo` needed.
  let highlightDays: readonly string[] | undefined;
  if (time.whenMode === "range" && startDay && endDay) {
    const start = new Date(startDay);
    const end = new Date(endDay);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
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
      highlightDays = days;
    }
  }

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
      const cur = timeOfDayToSpanValues(
        next,
        time.timeOfDayStart || "09:00",
        time.timeOfDayEnd || "18:00",
      );
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
        onActivate={(mode) => applyWhenMode(mode)}
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
        <div
          className="space-y-2 rounded-lg border border-border bg-surface-0 p-3"
          data-testid="when-calendar"
        >
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
              <Button
                key={q.id}
                type="button"
                variant="light"
                size="xs"
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
                data-testid={`when-calendar-quick-${q.id}`}
              >
                {t(q.labelKey)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {time.whenMode === "reference" ? (
        <div
          data-testid="when-reference-catalog"
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-0 p-3"
        >
          <Folder size={20} className="shrink-0 text-foreground-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">
              {t("quickCreate.referenceRangeTitle")}
            </div>
            <div className="text-[10px] text-foreground-muted">
              {t("quickCreate.referenceRangeSub")}
            </div>
          </div>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
            {t("quickCreate.referenceRangeBadge")}
          </span>
        </div>
      ) : null}

      {time.whenMode !== "none" ? <FormDivider /> : null}

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
        size="sm"
        variant="default"
        leftSection={<Plus size={12} aria-hidden="true" />}
        onClick={addWindow}
      >
        {t("quickCreate.windowsAdd")}
      </Button>
    </>
  );
}
