"use client";

import {
  Button,
  CloseButton,
  ColorInput,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  FileText,
  Folder,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { EventDetailsSubPanel } from "./EventDetailsSubPanel";
import { ProjectPicker } from "./ProjectPicker";
import { TimeSuggestionInput } from "./TimeSuggestionInput";
import { WorkflowBatch } from "./WorkflowBatch";

const EVENT_COLOR_SWATCHES = [
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#6b7280",
];

const DATE_FMT = "YYYY-MM-DD";

/** Default event duration: 1.5 hours (90 minutes). */
const DEFAULT_DURATION_MS = 90 * 60_000;

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
 * Event workflow form — Google Calendar-style create panel.
 *
 * Structure (top → bottom):
 *   - Header bar (workflow chip + heading + close)
 *   - Title input (big, with visible underline — primary affordance)
 *   - Start row (date + time as 2 columns, 1 row — no label, no icon)
 *   - End row (date + time as 2 columns, 1 row — no label, no icon)
 *   - All day row (plain switch — no label, no icon)
 *   - Color row (icon column)
 *   - Project picker (icon column)
 *   - "Event details" affordance (sub-panel: period-label toggle + sub-tasks + refs)
 *
 * The icon column is supplied structurally by `FormRow` (shared/ui/form)
 * — sections that need it use `FormRow`, sections that don't (start/end/
 * all-day) skip it. Date and time are paired on the same row; the time
 * column disappears when all-day is on. Multi-day is implicit: when end
 * date is after start date the event spans multiple days — no toggle.
 *
 * Inputs use Mantine primitives only.
 */
export function QuickCreateEvent() {
  const { t } = useTranslation();

  const title = useQuickCreateStore((s) => s.identity.title);
  const setField = useQuickCreateStore((s) => s.setField);
  const close = useQuickCreateStore((s) => s.close);
  const mode = useQuickCreateStore((s) => s.mode);

  const spanStart = useQuickCreateStore((s) => s.time.span.start);
  const spanEnd = useQuickCreateStore((s) => s.time.span.end);
  const whenMode = useQuickCreateStore((s) => s.time.whenMode);
  const timeOfDayMode = useQuickCreateStore((s) => s.time.timeOfDayMode);
  const visualColor = useQuickCreateStore((s) => s.identity.visual.color);
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const setActivePanel = useQuickCreateStore((s) => s.setActivePanel);

  const allDay = timeOfDayMode === "all-day";

  const detailsOpen = activePanel === "event-details";
  const openDetails = () => setActivePanel("event-details");
  const closeDetails = () => setActivePanel("base");

  /** Tracks whether the user explicitly changed the end time. */
  const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);

  const startDate = useMemo(() => isoToDate(spanStart), [spanStart]);
  const endDate = useMemo(() => isoToDate(spanEnd), [spanEnd]);
  const startTime = useMemo(() => isoToTime(spanStart), [spanStart]);
  const endTime = useMemo(() => isoToTime(spanEnd), [spanEnd]);

  /** Default scroll target for time dropdowns: current time of day. */
  const defaultTimeScroll = useMemo(() => nowHHMM(), []);

  /** Default scroll target for end time: start + 1.5h or current + 1.5h. */
  const defaultEndTimeScroll = useMemo(() => {
    const base = startTime || defaultTimeScroll;
    const [h, m] = base.split(":").map(Number);
    const totalMin = h * 60 + m + 90;
    const eh = Math.floor(totalMin / 60) % 24;
    const em = totalMin % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }, [startTime, defaultTimeScroll]);

  const toggleAllDay = useCallback(
    (next: boolean) => {
      setField("time.timeOfDayMode", next ? "all-day" : "range");
      if (next) {
        setField("time.timeOfDayStart", "00:00");
        setField("time.timeOfDayEnd", "23:59");
      }
      // Default sensible values when fields are empty so the picker shows.
      if (!spanStart && !spanEnd) {
        const now = new Date();
        const iso = now.toISOString();
        setField("time.span.start", iso);
        setField("time.span.end", iso);
        setField("time.whenMode", "day");
      }
    },
    [setField, spanStart, spanEnd],
  );

  const updateStartDate = useCallback(
    (value: string | null) => {
      const iso = value ? dateToIso(new Date(value)) : "";
      setField("time.span.start", iso);
      if (!spanEnd && iso) setField("time.span.end", iso);
      if (iso && whenMode === "none") setField("time.whenMode", "day");
      // Reset manual flag when the date changes — re-enable auto-shift.
      setEndTimeManuallySet(false);
    },
    [setField, spanEnd, whenMode],
  );

  const updateStartTime = useCallback(
    (next: string) => {
      const result = timeToIso(spanStart, next);
      if (!result) return;
      setField("time.span.start", result);
      // Auto-shift end time unless the user manually set it.
      if (!endTimeManuallySet && spanEnd) {
        const start = new Date(result);
        if (!Number.isNaN(start.getTime())) {
          const autoEnd = new Date(start.getTime() + DEFAULT_DURATION_MS);
          setField("time.span.end", autoEnd.toISOString());
        }
      }
    },
    [setField, spanStart, spanEnd, endTimeManuallySet],
  );

  const updateEndDate = useCallback(
    (value: string | null) => {
      const iso = value ? dateToIso(new Date(value)) : "";
      setField("time.span.end", iso);
      // Determine if the event spans multiple days.
      const start = new Date(spanStart);
      const end = new Date(iso);
      const sameDay =
        iso &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        start.toDateString() === end.toDateString();
      setField("time.whenMode", sameDay ? "day" : "range");
    },
    [setField, spanStart],
  );

  const updateEndTime = useCallback(
    (next: string) => {
      const result = timeToIso(spanEnd, next);
      if (result) {
        setEndTimeManuallySet(true);
        setField("time.span.end", result);
      }
    },
    [setField, spanEnd],
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
                data-testid="quick-create-event-close"
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
              data-testid="event-title"
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

        {/* Start row — Date + Time on one row; no label needed. */}
        <div className="px-4 py-3">
          <FormRow
            trailing={
              !allDay ? (
                <TimeSuggestionInput
                  value={startTime}
                  onChange={updateStartTime}
                  aria-label={t("quickCreate.startTimeLabel") || "Start time"}
                  data-testid="event-start-time"
                  className="w-[5.5rem]"
                  defaultScrollTo={defaultTimeScroll}
                />
              ) : null
            }
          >
            <DateInput
              value={startDate}
              onChange={updateStartDate}
              valueFormat={DATE_FMT}
              placeholder={t("quickCreate.startDate") || "Start date"}
              size="sm"
              clearable
              popoverProps={{ withinPortal: false }}
              data-testid={allDay ? "event-start-all-day" : "event-start-date"}
              className="w-full"
            />
          </FormRow>
        </div>

        {/* End row */}
        <div className="px-4 py-3">
          <FormRow
            trailing={
              !allDay ? (
                <TimeSuggestionInput
                  value={endTime}
                  onChange={updateEndTime}
                  aria-label={t("quickCreate.endTimeLabel") || "End time"}
                  data-testid="event-end-time"
                  className="w-[5.5rem]"
                  defaultScrollTo={defaultEndTimeScroll}
                />
              ) : null
            }
          >
            <DateInput
              value={endDate}
              onChange={updateEndDate}
              valueFormat={DATE_FMT}
              placeholder={t("quickCreate.endDate") || "End date"}
              size="sm"
              clearable
              popoverProps={{ withinPortal: false }}
              data-testid={allDay ? "event-end-all-day" : "event-end-date"}
              className="w-full"
            />
          </FormRow>
        </div>

        {/* All day */}
        <div className="px-4 py-3">
          <FormRow>
            <span className="text-sm text-foreground">
              {t("quickCreate.allDay") || "All day"}
            </span>
            <Switch
              checked={allDay}
              onChange={(e) => toggleAllDay(e.currentTarget.checked)}
              size="sm"
              data-testid="event-all-day-toggle"
              className="ml-auto"
            />
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
                swatches={EVENT_COLOR_SWATCHES}
                data-testid="event-color"
                className="w-[120px]"
              />
            }
          >
            <ProjectPicker testId="event-project-picker" />
          </FormRow>
        </div>

        {/* Details affordance */}
        <div className="px-4 py-3">
          <FormRow icon={<FileText className="h-4 w-4" aria-hidden />}>
            <Button
              variant="default"
              size="sm"
              onClick={openDetails}
              data-testid="event-open-details"
              fullWidth
              className="w-full"
            >
              {t("quickCreate.detailsEventTitle") || "Event details"}
            </Button>
          </FormRow>
        </div>
      </Stack>

      {createPortal(
        <EventDetailsSubPanel opened={detailsOpen} onClose={closeDetails} />,
        document.body,
      )}
    </Stack>
  );
}
