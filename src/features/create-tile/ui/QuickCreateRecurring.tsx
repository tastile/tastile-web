"use client";

import {
  Badge,
  Button,
  CloseButton,
  ColorInput,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  CalendarDays,
  CalendarRange,
  FileText,
  Folder,
  Repeat,
  Sun,
  Timer,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/shared/i18n/use-translation";
import { TileKind } from "@/shared/model/v1/constants";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { ProjectPicker } from "./ProjectPicker";
import { RecurringDetailsSubPanel } from "./RecurringDetailsSubPanel";
import { TimeSuggestionInput } from "./TimeSuggestionInput";
import { WorkflowBatch } from "./WorkflowBatch";

const REPEAT_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "interval", label: "Interval" },
] as const;

const INTERVAL_UNITS = ["min", "hour", "day"] as const;

const DURATION_PRESETS_MIN = [15, 30, 60, 90, 120] as const;

const RECURRING_COLOR_SWATCHES = [
  "#5e6ad2",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#6b7280",
];

const WEEKDAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DATE_FMT = "YYYY-MM-DD";

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

/**
 * Recurring workflow form — Google Calendar-style create panel.
 *
 * Structure (top → bottom):
 *   - Header bar (workflow chip + heading + close)
 *   - Title input (big, underlined; aligns structurally via FormRow no-icon)
 *   - Start date + Start time on one line; all-day removes time
 *   - All day switch (icon column)
 *   - Repeat mode (icon column; segmented control: daily/weekly/monthly/interval)
 *   - Per-mode secondary controls (weekday chips, interval value+unit)
 *   - Repeat until (icon column; toggle + date)
 *   - Duration per instance (icon column; chips + manual minutes)
 *   - Color row (icon column)
 *   - Project picker (icon column)
 *   - "Recurring details" affordance (sub-panel)
 *
 * The icon column is supplied structurally by `FormRow` (shared/ui/form).
 * Time input opens a 15-min dropdown (anchored to the current value) and
 * also accepts custom entry.
 */
export function QuickCreateRecurring() {
  const { t } = useTranslation();

  const title = useQuickCreateStore((s) => s.identity.title);
  const setField = useQuickCreateStore((s) => s.setField);
  const close = useQuickCreateStore((s) => s.close);
  const mode = useQuickCreateStore((s) => s.mode);
  const visualColor = useQuickCreateStore((s) => s.identity.visual.color);

  const spanStart = useQuickCreateStore((s) => s.time.span.start);
  const timeOfDayMode = useQuickCreateStore((s) => s.time.timeOfDayMode);
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
  const openDetails = () => setActivePanel("recurring-details");
  const closeDetails = () => setActivePanel("base");

  const [manualDuration, setManualDuration] = useState<string | number>(
    msToMin(durationMinMs) || 30,
  );

  const startDate = useMemo(() => isoToDate(spanStart), [spanStart]);
  const startTime = useMemo(() => isoToTime(spanStart), [spanStart]);
  const allDay = timeOfDayMode === "all-day";

  const presetDuration = useMemo(() => {
    const m = msToMin(durationMinMs);
    return DURATION_PRESETS_MIN.includes(m as (typeof DURATION_PRESETS_MIN)[number])
      ? m
      : null;
  }, [durationMinMs]);

  const applyDuration = useCallback(
    (minutes: number) => {
      setManualDuration(minutes);
      setField("time.durationMinMax.minMs", minToMs(minutes));
      setField("time.durationMinMax.maxMs", minToMs(minutes));
    },
    [setField],
  );

  const handleRepeatChange = useCallback(
    (value: string) => {
      const next = value as typeof REPEAT_OPTIONS[number]["value"];
      setField("recurring.repeatMode", next);
      setField("identity.kind", TileKind.RECURRING);
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

  const updateStartDate = useCallback(
    (value: string | null) => {
      const iso = value ? dateToIso(new Date(value)) : "";
      setField("time.span.start", iso);
      if (!iso && !endDate) setField("time.whenMode", "none");
      else setField("time.whenMode", "day");
    },
    [setField, endDate],
  );

  const updateStartTime = useCallback(
    (next: string) => {
      const result = timeToIso(spanStart, next);
      if (result) setField("time.span.start", result);
    },
    [setField, spanStart],
  );

  const toggleAllDay = useCallback(
    (next: boolean) => {
      setField("time.timeOfDayMode", next ? "all-day" : "range");
      if (next) {
        setField("time.timeOfDayStart", "00:00");
        setField("time.timeOfDayEnd", "23:59");
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

  return (
    <Stack gap={0} className="h-full">
      <Stack gap={0} className="flex-1 overflow-y-auto">
        {/* Title — close button in icon column, batch row below */}
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
              classNames={{
                input:
                  "text-[20px] font-semibold leading-snug text-foreground placeholder:text-[var(--foreground-muted)] placeholder:font-normal bg-transparent px-0 h-auto border-b-2 border-foreground/60 focus:border-foreground",
              }}
            />
          </FormRow>
        </div>
        <WorkflowBatch />

        {/* Start row — Date + Time; all-day hides time. */}
        <div className="px-4 py-3">
          <FormRow
            trailing={
              !allDay ? (
                <TimeSuggestionInput
                  value={startTime}
                  onChange={updateStartTime}
                  aria-label={t("quickCreate.startTimeLabel") || "Start time"}
                  data-testid="recurring-start-time"
                  className="w-[5.5rem]"
                />
              ) : null
            }
          >
            <DateInput
              value={startDate}
              onChange={updateStartDate}
              valueFormat={DATE_FMT}
              placeholder={t("quickCreate.startDate") || "Date"}
              size="sm"
              clearable
              popoverProps={{ withinPortal: false }}
              data-testid={allDay ? "recurring-start-all-day" : "recurring-start-date"}
              className="w-full"
            />
          </FormRow>
        </div>

        {/* All day */}
        <div className="px-4 py-3">
          <FormRow icon={<Sun className="h-4 w-4" aria-hidden />}>
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

        {/* Repeat mode */}
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
                {WEEKDAY_LABELS_EN.map((label, bit) => {
                  const active = (weekdayMask & (1 << bit)) !== 0;
                  return (
                    <Badge
                      key={bit}
                      variant={active ? "filled" : "light"}
                      color={active ? "indigo" : "gray"}
                      size="lg"
                      style={{ cursor: "pointer", minWidth: "2.75rem" }}
                      onClick={() => toggleWeekday(bit)}
                      data-testid={`recurring-weekday-${bit}`}
                    >
                      {label}
                    </Badge>
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
                  size="xs"
                  className="w-24"
                  data-testid="recurring-interval-value"
                />
                <SegmentedControl
                  fullWidth
                  size="xs"
                  value={intervalUnit}
                  onChange={setIntervalUnit}
                  data={INTERVAL_UNITS.map((u) => ({ value: u, label: u }))}
                  data-testid="recurring-interval-unit"
                />
              </Group>
            </FormRow>
          </div>
        ) : null}

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
                    size="xs"
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

        {/* Duration per instance */}
        <div className="px-4 py-3">
          <FormRow icon={<Timer className="h-4 w-4" aria-hidden />}>
            <div className="w-full">
              <div className="flex flex-wrap items-center gap-1.5">
                {DURATION_PRESETS_MIN.map((m) => (
                  <Badge
                    key={m}
                    variant={presetDuration === m ? "filled" : "light"}
                    color={presetDuration === m ? "indigo" : "gray"}
                    size="lg"
                    style={{ cursor: "pointer", minWidth: "3.25rem" }}
                    onClick={() => applyDuration(m)}
                    data-testid={`recurring-duration-preset-${m}`}
                  >
                    {m < 60 ? `${m}m` : `${m / 60}h`}
                  </Badge>
                ))}
              </div>
              <NumberInput
                value={manualDuration}
                onChange={(v) => {
                  setManualDuration(v);
                  const n = typeof v === "number" ? v : Number(v);
                  if (Number.isFinite(n) && n > 0) applyDuration(n);
                }}
                suffix=" min"
                min={1}
                max={1440}
                size="xs"
                mt="xs"
                aria-label={t("quickCreate.durationManual") || "Custom minutes"}
                placeholder={t("quickCreate.durationManual") || "Custom minutes"}
                data-testid="recurring-duration-manual"
              />
            </div>
          </FormRow>
        </div>

        {/* Project + Color */}
        <div className="px-4 py-3">
          <FormRow
            icon={<Folder className="h-4 w-4" aria-hidden />}
            trailing={
              <ColorInput
                value={visualColor}
                onChange={(v) => setField("identity.visual.color", v)}
                size="xs"
                format="hex"
                fixOnBlur
                withPicker={false}
                withEyeDropper={false}
                aria-label={t("quickCreate.colorLabel") || "Color"}
                swatches={RECURRING_COLOR_SWATCHES}
                data-testid="recurring-color"
                className="w-[120px]"
              />
            }
          >
            <ProjectPicker testId="recurring-project-picker" />
          </FormRow>
        </div>

        {/* Details affordance */}
        <div className="px-4 py-3">
          <FormRow icon={<FileText className="h-4 w-4" aria-hidden />}>
            <Button
              variant="default"
              size="sm"
              onClick={openDetails}
              data-testid="recurring-open-details"
              fullWidth
            >
              {t("quickCreate.detailsRecurringTitle") || "Recurring details"}
            </Button>
          </FormRow>
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
