"use client";

import {
  CloseButton,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  CalendarDays,
  CalendarRange,
  Repeat,
  Sun,
  Timer,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { QuickCreateSubmitButton } from "./QuickCreateSubmitButton";
import { RecurringDetailsSubPanel } from "./RecurringDetailsSubPanel";
import { TimeSuggestionInput } from "./TimeSuggestionInput";
import { WorkflowBatch } from "./WorkflowBatch";
import { weekdayLabelsFor } from "./quick-create-utils";
import { DetailsAffordanceButton } from "./sections/DetailsAffordanceButton";
import { MemoSection } from "./sections/MemoSection";
import { ProjectColorRow } from "./sections/ProjectColorRow";
import { SubtasksSection } from "./sections/SubtasksSection";

const REPEAT_OPTIONS_BASE = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "interval", label: "Interval" },
] as const;

/**
 * Repeat-mode selector entries shown in the segmented control. The first
 * entry, "once", is the safe default — the user has to opt-in to a
 * recurring schedule (see AGENTS feedback "ビュー切り替えで誤った操作で
 * 繰り返しを有効にしてしまった"). REPEAT_OPTIONS_BASE alone omits "once"
 * because other callers (e.g. label-key lookups) only enumerate the
 * active modes.
 */
const REPEAT_OPTIONS = [
  { value: "once", label: "Do not repeat" },
  ...REPEAT_OPTIONS_BASE,
] as const;

const INTERVAL_UNITS = ["min", "hour", "day"] as const;

const RECURRING_COLOR_SWATCHES = [
  "#5e6ad2",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#6b7280",
];

const DATE_FMT = "YYYY-MM-DD";

const DURATION_PRESETS_MIN = [15, 30, 60, 90, 120] as const;
/** Sentinel value for the duration Select when the current value is not a preset. */
const DURATION_CUSTOM_VALUE = "__custom_duration__";
/** Default time-of-day for non-interval modes when the user hasn't picked one. */
const DEFAULT_TIME_OF_DAY_START = "09:00";
const DEFAULT_TIME_OF_DAY_END = "09:30";

function minToMs(min: number): number {
  return min * 60_000;
}

function msToMin(ms: number | null): number {
  if (ms == null) return 0;
  return Math.round(ms / 60_000);
}

function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateToIso(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function isoToTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function timeToIso(baseIso: string, time: string): string {
  if (!baseIso || !time) return "";
  const base = new Date(baseIso);
  if (Number.isNaN(base.getTime())) return "";
  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return baseIso;
  base.setHours(hh, mm, 0, 0);
  return base.toISOString();
}

/** Returns true when the repeat mode is calendar-bound (daily/weekly/monthly). */
function isCalendarMode(mode: string): boolean {
  return mode === "daily" || mode === "weekly" || mode === "monthly";
}

/**
 * Recurring workflow form — Google Calendar-style create panel.
 *
 * Structure (top → bottom):
 *   - Header bar (workflow chip + heading + close)
 *   - Title input (big, underlined; primary affordance)
 *   - Workflow batch row
 *   - Repeat mode (segmented control: daily/weekly/monthly/interval)
 *   - Per-mode secondary controls (weekdays, interval value+unit)
 *   - Time row — adaptive:
 *     - calendar modes (daily/weekly/monthly): time-of-day only
 *     - interval: full date+time (first occurrence)
 *   - All day switch (calendar modes only)
 *   - Repeat until (toggle + date)
 *   - Duration per instance (Select + custom NumberInput)
 *   - `DetailsAffordanceButton` (opens the "recurring-details" sub-panel)
 *   - Bottom set (top-bordered group):
 *     - `MemoSection` (borderless autosizing textarea bound to `meta.memo`)
 *     - `ProjectColorRow` (project chip row + compact color swatches)
 *
 * The icon column is supplied structurally by `FormRow`. Time input opens
 * a 15-min dropdown (anchored to the current value) and also accepts
 * custom entry.
 */
export function QuickCreateRecurring() {
  const { t, locale } = useTranslation();

  const title = useQuickCreateStore((s) => s.identity.title);
  const setField = useQuickCreateStore((s) => s.setField);
  const close = useQuickCreateStore((s) => s.close);

  const spanStart = useQuickCreateStore((s) => s.time.span.start);
  const timeOfDayMode = useQuickCreateStore((s) => s.time.timeOfDayMode);
  const timeOfDayStart = useQuickCreateStore((s) => s.time.timeOfDayStart);
  const timeOfDayEnd = useQuickCreateStore((s) => s.time.timeOfDayEnd);
  const repeatMode = useQuickCreateStore((s) => s.recurring.repeatMode);
  const weekdayMask = useQuickCreateStore((s) => s.recurring.weekdayMask);
  const intervalValue = useQuickCreateStore((s) => s.recurring.intervalValue);
  const intervalUnit = useQuickCreateStore((s) => s.recurring.intervalUnit);
  const endDate = useQuickCreateStore((s) => s.recurring.endDate);

  const durationMinMs = useQuickCreateStore(
    (s) => s.time.durationMinMax.minMs,
  );
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const setActivePanel = useQuickCreateStore((s) => s.setActivePanel);

  const detailsOpen = activePanel === "recurring-details";
  const closeDetails = () => setActivePanel("base");

  const allDay = timeOfDayMode === "all-day";
  const calendarMode = isCalendarMode(repeatMode);

  const startDate = useMemo(() => isoToDate(spanStart), [spanStart]);
  const startTime = useMemo(() => isoToTime(spanStart), [spanStart]);

  // Translated weekday labels — bit 0 = Sunday … bit 6 = Saturday, matching
  // the store's `weekdayMask` convention. Resolved via the i18n tree so the
  // chip rows stay in lockstep with the rest of the locale.
  const weekdayLabels = useMemo(() => weekdayLabelsFor(locale), [locale]);

  // ---------- time row logic (adaptive by repeat mode) ----------

  const timeOfDayValue = calendarMode ? timeOfDayStart : startTime;

  const updateTime = useCallback(
    (next: string) => {
      if (calendarMode) {
        setField("time.timeOfDayStart", next);
        // Weekly/Monthly keep the legacy single-picker behaviour: mirror
        // start into end so the wire still has both bounds and the user
        // can refine per-instance via duration. Daily uses a separate
        // end-time picker (see `updateDailyEndTime` below) so its
        // end stays authored by the user.
        if (repeatMode !== "daily") {
          setField("time.timeOfDayEnd", next);
        }
        if (timeOfDayMode !== "range") setField("time.timeOfDayMode", "range");
        return;
      }
      const result = timeToIso(spanStart, next);
      if (result) setField("time.span.start", result);
    },
    [calendarMode, repeatMode, setField, spanStart, timeOfDayMode],
  );

  const updateDailyStartTime = useCallback(
    (next: string) => {
      setField("time.timeOfDayStart", next);
      if (timeOfDayMode !== "range") setField("time.timeOfDayMode", "range");
    },
    [setField, timeOfDayMode],
  );

  const updateDailyEndTime = useCallback(
    (next: string) => {
      setField("time.timeOfDayEnd", next);
      if (timeOfDayMode !== "range") setField("time.timeOfDayMode", "range");
    },
    [setField, timeOfDayMode],
  );

  const updateStartDate = useCallback(
    (value: string | null) => {
      const iso = value ? dateToIso(new Date(value)) : "";
      setField("time.span.start", iso);
      if (!iso && !endDate) setField("time.whenMode", "none");
      else setField("time.whenMode", "day");
    },
    [setField, endDate],
  );

  const toggleAllDay = useCallback(
    (next: boolean) => {
      setField("time.timeOfDayMode", next ? "all-day" : "range");
      if (next) {
        setField("time.timeOfDayStart", "00:00");
        setField("time.timeOfDayEnd", "23:59");
      } else if (!timeOfDayStart) {
        // Restore a sensible default when switching off an empty all-day row.
        setField("time.timeOfDayStart", DEFAULT_TIME_OF_DAY_START);
        setField("time.timeOfDayEnd", DEFAULT_TIME_OF_DAY_END);
      }
    },
    [setField, timeOfDayStart],
  );

  // ---------- weekday / interval secondary controls ----------

  const handleRepeatChange = useCallback(
    (value: string) => {
      const next = value as (typeof REPEAT_OPTIONS)[number]["value"];
      setField("recurring.repeatMode", next);
    },
    [setField],
  );

  const toggleWeekday = useCallback(
    (bit: number) => {
      setField("recurring.weekdayMask", weekdayMask ^ (1 << bit));
    },
    [weekdayMask, setField],
  );

  const setIntervalMin = useCallback(
    (n: number) => {
      const min = intervalUnit === "min" ? 5 : 1;
      setField("recurring.intervalValue", Math.max(min, Math.min(365, n)));
    },
    [intervalUnit, setField],
  );

  const setIntervalUnit = useCallback(
    (unit: string) => {
      const next = unit as (typeof INTERVAL_UNITS)[number];
      setField("recurring.intervalUnit", next);
      const defaults = { min: 30, hour: 1, day: 1 } as const;
      if (
        (next === "min" && intervalValue < 5) ||
        (next === "hour" && intervalValue > 24) ||
        (next === "day" && intervalValue > 31)
      ) {
        setField("recurring.intervalValue", defaults[next]);
      }
    },
    [intervalValue, setField],
  );

  // ---------- repeat until ----------

  const toggleEndDate = useCallback(
    (next: boolean) => {
      if (next) {
        const today = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00:00.000Z`;
        setField("recurring.endDate", iso);
      } else {
        setField("recurring.endDate", "");
      }
    },
    [setField],
  );

  const endDateValue = useMemo(() => {
    if (!endDate) return null;
    const d = new Date(endDate);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [endDate]);

  const updateEndDate = useCallback(
    (value: string | null) => {
      if (!value) {
        setField("recurring.endDate", "");
      } else {
        const d = new Date(value);
        const pad = (n: number) => String(n).padStart(2, "0");
        const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`;
        setField("recurring.endDate", iso);
      }
    },
    [setField],
  );

  // ---------- duration (Select + custom) ----------
  //
  // The dropdown shows preset values plus a "Custom…" sentinel. The
  // Select value is held in local UI state (`isCustomMode`) so picking
  // Custom doesn't immediately re-derive back to the preset string —
  // if the Select's value were derived purely from `isDurationPreset`
  // (which is computed from the store value), the store never changes
  // on a Custom selection, so `isDurationPreset` would stay true and
  // the dropdown would flicker back to e.g. "30 min" before the user
  // could interact with the NumberInput. The store still holds the
  // actual minute count (preset or custom); `isCustomMode` only tracks
  // which option the dropdown should display right now.

  const durationMinutes = msToMin(durationMinMs);
  const isDurationPreset =
    durationMinutes > 0 &&
    DURATION_PRESETS_MIN.includes(
      durationMinutes as (typeof DURATION_PRESETS_MIN)[number],
    );

  // Whether the Select is currently displaying the Custom sentinel.
  // Initial seed: if the store already holds a custom value (e.g. the
  // user reopened the panel after typing 45), we start in custom mode.
  const [isCustomMode, setIsCustomMode] = useState(!isDurationPreset);

  const [customDuration, setCustomDuration] = useState<string | number>(
    isDurationPreset ? durationMinutes : durationMinutes || 30,
  );

  // Tracks the most recent duration we wrote ourselves from the custom
  // NumberInput, so the mirror effect can distinguish self-writes from
  // external store changes (template load, seed reset, …).
  const lastSelfWrittenDurationRef = useRef<number | null>(null);

  // Mirror external store changes (template load, seed reset, …) into
  // the local Custom-mode flag. We skip the flip when the new duration
  // equals our last self-written value, so typing a preset (e.g. "30")
  // in the NumberInput while in custom mode doesn't kick us back to
  // the "30 min" preset. This is the correct mirror pattern; without
  // it the dropdown desyncs from the store after a template swap.
  // react-doctor-disable-next-line react-hooks-js/set-state-in-effect
  useEffect(() => {
    if (lastSelfWrittenDurationRef.current === durationMinutes) return;
    setIsCustomMode(!isDurationPreset);
  }, [isDurationPreset, durationMinutes]);

  const DURATION_OPTIONS = useMemo(
    () => [
      ...DURATION_PRESETS_MIN.map((m) => ({
        value: String(m),
        label: m < 60 ? `${m} min` : `${m / 60} hours`,
      })),
      {
        value: DURATION_CUSTOM_VALUE,
        label: t("quickCreate.durationCustom") || "Custom…",
      },
    ],
    [t],
  );

  const selectedDuration = isCustomMode
    ? DURATION_CUSTOM_VALUE
    : String(durationMinutes);

  const applyDuration = useCallback(
    (minutes: number) => {
      setField("time.durationMinMax.minMs", minToMs(minutes));
      setField("time.durationMinMax.maxMs", minToMs(minutes));
    },
    [setField],
  );

  const handleDurationChange = useCallback(
    (value: string | null) => {
      if (!value || value === DURATION_CUSTOM_VALUE) {
        // Switching into custom — keep the user's current value as the
        // custom seed so they don't lose what they had.
        setIsCustomMode(true);
        setCustomDuration(durationMinutes > 0 ? durationMinutes : 30);
        return;
      }
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes <= 0) return;
      setIsCustomMode(false);
      setCustomDuration(minutes);
      applyDuration(minutes);
    },
    [applyDuration, durationMinutes],
  );

  const handleCustomDurationChange = useCallback(
    (v: string | number) => {
      setCustomDuration(v);
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n > 0) {
        lastSelfWrittenDurationRef.current = n;
        applyDuration(n);
      }
    },
    [applyDuration],
  );

  return (
    <Stack gap={0} className="h-full">
      <Stack gap={0} className="flex-1 overflow-y-auto">
        {/* Title — close button in icon column, submit button in trailing slot */}
        <div className="px-4 py-2">
          <FormRow
            icon={
              <CloseButton
                onClick={close}
                aria-label={t("quickCreate.cancel")}
                data-testid="quick-create-recurring-close"
                size="sm"
              />
            }
            trailing={<QuickCreateSubmitButton />}
          >
            <TextInput
              variant="unstyled"
              size="lg"
              placeholder={t("quickCreate.titlePlaceholder") || t("quickCreate.placeholder")}
              value={title}
              onChange={(e) => setField("identity.title", e.currentTarget.value)}
              required
              data-testid="recurring-title"
              autoFocus
              // Visible bottom underline is enforced by a CSS rule in
              // `src/app/globals.css` (`.qc-underline-input`) — Mantine v9's
              // `mantine-Input-input` module class sets a shorthand `border`
              // that would otherwise win over Tailwind's `border-b-2`.
              classNames={{
                input:
                  "qc-underline-input text-[20px] font-semibold leading-snug text-foreground placeholder:text-[var(--foreground-muted)] placeholder:font-normal bg-transparent px-0 h-auto",
              }}
            />
          </FormRow>
        </div>
        <WorkflowBatch />

        {/* Repeat mode — chosen first so the time row below can adapt */}
        <div className="px-4 py-3">
          <FormRow icon={<Repeat className="h-4 w-4" aria-hidden />}>
            <div className="w-full">
              <SegmentedControl
                fullWidth
                size="sm"
                value={repeatMode}
                onChange={handleRepeatChange}
                data={REPEAT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                data-testid="recurring-mode-tabs"
              />
            </div>
          </FormRow>
        </div>

        {/* Per-mode secondary controls */}
        {repeatMode === "weekly" ? (
          <div className="px-4 py-3">
            <FormRow icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
              <div
                className="flex flex-wrap gap-1.5"
                data-testid="recurring-weekday-row"
              >
                {weekdayLabels.map((label, bit) => {
                  const active = (weekdayMask & (1 << bit)) !== 0;
                  return (
                    <button
                      key={bit}
                      type="button"
                      onClick={() => toggleWeekday(bit)}
                      aria-pressed={active}
                      data-testid={`recurring-weekday-${bit}`}
                      className={
                        "inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors " +
                        (active
                          ? "border-primary bg-primary text-primary-fg shadow-sm"
                          : "border-border bg-surface-1 text-foreground-muted hover:bg-surface-2")
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </FormRow>
          </div>
        ) : null}

        {repeatMode === "interval" ? (
          <div className="px-4 py-3">
            <FormRow icon={<Timer className="h-4 w-4" aria-hidden />}>
              <Group gap="xs" align="flex-end" wrap="wrap" className="w-full">
                <NumberInput
                  label={t("quickCreate.intervalValueLabel") || "Every"}
                  value={intervalValue}
                  onChange={(v) => {
                    const n = typeof v === "number" ? v : Number(v);
                    if (Number.isFinite(n) && n > 0) setIntervalMin(n);
                  }}
                  min={1}
                  max={365}
                  size="sm"
                  className="w-24"
                  data-testid="recurring-interval-value"
                />
                <SegmentedControl
                  fullWidth
                  size="sm"
                  value={intervalUnit}
                  onChange={setIntervalUnit}
                  data={INTERVAL_UNITS.map((u) => ({ value: u, label: u }))}
                  data-testid="recurring-interval-unit"
                />
              </Group>
            </FormRow>
          </div>
        ) : null}

        {/* Time row — adapts to repeat mode */}
        {calendarMode ? (
          // Daily mode: a real time window (start + end) — the start-only
          // picker was an obvious gap because almost no real use case fits
          // "start at 09:00 with no end". Weekly/Monthly keep the legacy
          // single-picker behaviour (All day + start, mirrored to end).
          repeatMode === "daily" ? (
            <>
              {/* All day — its own row, mirroring the Event pattern */}
              <div className="px-4 py-3">
                <FormRow>
                  <span className="text-sm text-foreground">
                    {t("quickCreate.allDay") || "All day"}
                  </span>
                  <Switch
                    checked={allDay}
                    onChange={(e) => toggleAllDay(e.currentTarget.checked)}
                    size="sm"
                    data-testid="recurring-all-day-toggle"
                    className="ml-auto"
                  />
                </FormRow>
              </div>
              {/* Time window — start + end pickers on a single row */}
              <div className="px-4 py-3">
                <FormRow
                  icon={<Sun className="h-4 w-4" aria-hidden />}
                  trailing={
                    <TimeSuggestionInput
                      value={timeOfDayEnd}
                      onChange={updateDailyEndTime}
                      aria-label={t("quickCreate.endTimeLabel") || "End time"}
                      data-testid="recurring-daily-end-time"
                      className="w-[5.5rem]"
                    />
                  }
                >
                  <TimeSuggestionInput
                    value={timeOfDayStart}
                    onChange={updateDailyStartTime}
                    aria-label={t("quickCreate.startTimeLabel") || "Start time"}
                    data-testid="recurring-daily-start-time"
                    className="w-[5.5rem]"
                  />
                </FormRow>
              </div>
            </>
          ) : (
            <div className="px-4 py-3">
              <FormRow
                icon={<Sun className="h-4 w-4" aria-hidden />}
                trailing={
                  <TimeSuggestionInput
                    value={timeOfDayValue}
                    onChange={updateTime}
                    aria-label={t("quickCreate.timeOfDayLabel") || "Time of day"}
                    data-testid="recurring-time-of-day"
                    className="w-[5.5rem]"
                  />
                }
              >
                <Switch
                  checked={allDay}
                  onChange={(e) => toggleAllDay(e.currentTarget.checked)}
                  label={t("quickCreate.allDay") || "All day"}
                  size="sm"
                  data-testid="recurring-all-day-toggle"
                  className="w-full"
                />
              </FormRow>
            </div>
          )
        ) : (
          <div className="px-4 py-3">
            <FormRow
              trailing={
                <TimeSuggestionInput
                  value={timeOfDayValue}
                  onChange={updateTime}
                  aria-label={t("quickCreate.startTimeLabel") || "Start time"}
                  data-testid="recurring-start-time"
                  className="w-[5.5rem]"
                />
              }
            >
              <DateInput
                value={startDate}
                onChange={updateStartDate}
                valueFormat={DATE_FMT}
                placeholder={t("quickCreate.startDate") || "First occurrence"}
                size="sm"
                clearable
                popoverProps={{ withinPortal: false }}
                data-testid="recurring-start-date"
                className="w-full"
              />
            </FormRow>
          </div>
        )}

        {/* Repeat until */}
        <div className="px-4 py-3">
          <FormRow icon={<CalendarRange className="h-4 w-4" aria-hidden />}>
            <Group justify="space-between" wrap="nowrap" className="w-full">
              <span className="text-sm text-foreground">
                {t("quickCreate.repeatEndLabel") || "Repeat until"}
              </span>
              <Group gap="xs" wrap="nowrap">
                {endDate ? (
                  <DateInput
                    value={endDateValue}
                    onChange={updateEndDate}
                    valueFormat={DATE_FMT}
                    size="sm"
                    popoverProps={{ withinPortal: false }}
                    data-testid="recurring-end-date"
                    className="w-[10rem]"
                  />
                ) : null}
                <Switch
                  checked={Boolean(endDate)}
                  onChange={(e) => toggleEndDate(e.currentTarget.checked)}
                  size="sm"
                  data-testid="recurring-end-toggle"
                />
              </Group>
            </Group>
          </FormRow>
        </div>

        {/* Duration per instance — Select + Custom NumberInput */}
        <div className="px-4 py-3">
          <FormRow icon={<Timer className="h-4 w-4" aria-hidden />}>
            <div className="w-full">
              <Select
                value={selectedDuration}
                onChange={handleDurationChange}
                data={DURATION_OPTIONS}
                size="sm"
                aria-label={t("quickCreate.durationLabel") || "Duration"}
                data-testid="recurring-duration-select"
                allowDeselect={false}
                checkIconPosition="right"
                className="w-full"
              />
              {selectedDuration === DURATION_CUSTOM_VALUE ? (
                <NumberInput
                  value={customDuration}
                  onChange={handleCustomDurationChange}
                  suffix=" min"
                  min={1}
                  max={1440}
                  size="sm"
                  mt="xs"
                  aria-label={t("quickCreate.durationManual") || "Custom minutes"}
                  placeholder={t("quickCreate.durationManual") || "Custom minutes"}
                  data-testid="recurring-duration-manual"
                  className="w-full"
                />
              ) : null}
            </div>
          </FormRow>
        </div>

        {/* "Recurring details" affordance — opens the recurring-details sub-panel */}
        <DetailsAffordanceButton
          panelKey="recurring-details"
          labelKey="quickCreate.detailsRecurringTitle"
          fallbackLabel="Recurring details"
          testId="recurring-open-details"
        />

        {/* Bottom "set": subtasks, project + color, then memo, grouped at the
            very bottom of every workflow form. The top border visually
            separates the set from the workflow-specific fields above. */}
        <div className="border-t border-border pt-1">
          {/* Subtasks — shared section component. Recurring tiles share the
              unified `plan.completion.tasks[]` array so the section renders
              an empty "no sub-tasks" hint until the user adds one. */}
          <SubtasksSection testId="recurring-subtasks" />

          {/* Project picker + color swatches (shared section component) */}
          <ProjectColorRow
            pickerTestId="recurring-project-picker"
            colorTestId="recurring-color"
            swatches={RECURRING_COLOR_SWATCHES}
          />

          {/* Memo — borderless autosizing textarea bound to meta.memo.
              Sits directly under the project+color row (memo beneath project). */}
          <MemoSection testId="recurring-memo" />
        </div>
      </Stack>

      {createPortal(
        <RecurringDetailsSubPanel
          opened={detailsOpen}
          onClose={closeDetails}
        />,
        document.body,
      )}
    </Stack>
  );
}
