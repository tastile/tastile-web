"use client";

import {
  CloseButton,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { EventDetailsSubPanel } from "./EventDetailsSubPanel";
import { QuickCreateSubmitButton } from "./QuickCreateSubmitButton";
import { WorkflowBatch } from "./WorkflowBatch";
import { DateTimeRow } from "./sections/DateTimeRow";
import { DetailsAffordanceButton } from "./sections/DetailsAffordanceButton";
import { MemoSection } from "./sections/MemoSection";
import { ProjectColorRow } from "./sections/ProjectColorRow";
import { SubtasksSection } from "./sections/SubtasksSection";

const EVENT_COLOR_SWATCHES = [
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#6b7280",
];

/** Default event duration: 1.5 hours (90 minutes). */
const DEFAULT_DURATION_MS = 90 * 60_000;

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
 *   - `DetailsAffordanceButton` (opens the "event-details" sub-panel)
 *   - Bottom set (top-bordered group):
 *     - `MemoSection` (borderless autosizing textarea bound to `meta.memo`)
 *     - `ProjectColorRow` (project chip row + compact color swatches)
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

  const spanStart = useQuickCreateStore((s) => s.time.span.start);
  const spanEnd = useQuickCreateStore((s) => s.time.span.end);
  const whenMode = useQuickCreateStore((s) => s.time.whenMode);
  const timeOfDayMode = useQuickCreateStore((s) => s.time.timeOfDayMode);
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const setActivePanel = useQuickCreateStore((s) => s.setActivePanel);

  const allDay = timeOfDayMode === "all-day";

  const detailsOpen = activePanel === "event-details";
  const closeDetails = () => setActivePanel("base");

  /** Tracks whether the user explicitly changed the end time. */
  const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);

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

  // DateTimeRow already converts the date-input's YYYY-MM-DD string into
  // an ISO before calling back, so we receive ISO here (or "" on clear).
  const updateStartDate = useCallback(
    (value: string | null) => {
      const iso = value ?? "";
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
      const iso = value ?? "";
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
        {/* Title — close button in icon column, submit button in trailing slot */}
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
            trailing={<QuickCreateSubmitButton />}
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
        <DateTimeRow
          dateValue={spanStart}
          onDateChange={updateStartDate}
          timeValue={allDay ? undefined : startTime}
          onTimeChange={allDay ? undefined : updateStartTime}
          datePlaceholder={t("quickCreate.startDate") || "Start date"}
          ariaLabelTime={t("quickCreate.startTimeLabel") || "Start time"}
          dateTestId={allDay ? "event-start-all-day" : "event-start-date"}
          timeTestId="event-start-time"
          defaultTimeScrollTo={defaultTimeScroll}
        />

        {/* End row */}
        <DateTimeRow
          dateValue={spanEnd}
          onDateChange={updateEndDate}
          timeValue={allDay ? undefined : endTime}
          onTimeChange={allDay ? undefined : updateEndTime}
          datePlaceholder={t("quickCreate.endDate") || "End date"}
          ariaLabelTime={t("quickCreate.endTimeLabel") || "End time"}
          dateTestId={allDay ? "event-end-all-day" : "event-end-date"}
          timeTestId="event-end-time"
          defaultTimeScrollTo={defaultEndTimeScroll}
        />

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

        {/* "Event details" affordance — opens the event-details sub-panel */}
        <DetailsAffordanceButton
          panelKey="event-details"
          labelKey="quickCreate.detailsEventTitle"
          fallbackLabel="Event details"
          testId="event-open-details"
        />

        {/* Bottom "set": subtasks, project + color, then memo, grouped at the
            very bottom of every workflow form. The top border visually
            separates the set from the workflow-specific fields above. */}
        <div className="border-t border-border pt-1">
          {/* Subtasks — shared section component. Events share the unified
              `plan.completion.tasks[]` array so the section renders an empty
              "no sub-tasks" hint until the user adds one. */}
          <SubtasksSection testId="event-subtasks" />

          {/* Project picker + color swatches (shared section component) */}
          <ProjectColorRow
            pickerTestId="event-project-picker"
            colorTestId="event-color"
            swatches={EVENT_COLOR_SWATCHES}
          />

          {/* Memo — borderless autosizing textarea bound to meta.memo.
              Sits directly under the project+color row (memo beneath project). */}
          <MemoSection testId="event-memo" />
        </div>
      </Stack>

      {createPortal(
        <EventDetailsSubPanel opened={detailsOpen} onClose={closeDetails} />,
        document.body,
      )}
    </Stack>
  );
}
