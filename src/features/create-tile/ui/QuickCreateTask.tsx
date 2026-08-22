"use client";

import {
  NumberInput,
  Select,
  Stack,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { CalendarDays, Timer } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow, RowSegmented } from "@/shared/ui/form";
import { QuickCreateHeader } from "./QuickCreateHeader";
import { TaskDetailsSubPanel } from "./TaskDetailsSubPanel";
import { TimeSuggestionInput } from "./TimeSuggestionInput";
import { WorkflowBatch } from "./WorkflowBatch";
import { DetailsAffordanceButton } from "./sections/DetailsAffordanceButton";
import { MemoSection } from "./sections/MemoSection";
import { ProjectColorRow } from "./sections/ProjectColorRow";
import { SubtasksSection } from "./sections/SubtasksSection";

/** Preset minute counts offered by the duration Select. */
const DURATION_PRESETS_MIN = [15, 30, 60, 90, 120] as const;
/** Sentinel value for the duration Select when the current value is not a preset. */
const DURATION_CUSTOM_VALUE = "__custom_duration__";

const TASK_COLOR_SWATCHES = [
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#6b7280",
];

const DATE_FMT = "YYYY-MM-DD";

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

function minToMs(min: number): number {
  return min * 60_000;
}

function msToMin(ms: number | null): number {
  if (ms == null) return 0;
  return Math.round(ms / 60_000);
}

/**
 * Task workflow form — Google Calendar-style create panel.
 *
 * Structure (top → bottom):
 *   - Header bar (workflow chip + heading + close)
 *   - Title input (big, underlined — primary affordance; aligns with
 *     field rows structurally via `FormRow` no-icon)
 *   - Due date + Due time on the same row (no label, no icon column)
 *   - Duration section (single dropdown of preset values)
 *   - `DetailsAffordanceButton` (opens the "task-details" sub-panel)
 *   - Bottom set (top-bordered group):
 *     - `MemoSection` (borderless autosizing textarea bound to `meta.memo`)
 *     - `ProjectColorRow` (project chip row + compact color swatches)
 *
 * Date and time live on one row (no label, no icon) — same pattern as
 * the Event form. The time input opens a dropdown of 15-min
 * recommendations but also accepts free-form custom entry.
 */
export function QuickCreateTask() {
  const { t } = useTranslation();

  const title = useQuickCreateStore((s) => s.identity.title);
  const setField = useQuickCreateStore((s) => s.setField);
  const close = useQuickCreateStore((s) => s.close);

  const spanStart = useQuickCreateStore((s) => s.time.span.start);
  const spanEnd = useQuickCreateStore((s) => s.time.span.end);
  const durationMinMs = useQuickCreateStore((s) => s.time.durationMinMax.minMs);
  const durationMaxMs = useQuickCreateStore((s) => s.time.durationMinMax.maxMs);
  const splitPolicy = useQuickCreateStore((s) => s.time.splitPolicy);
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const setActivePanel = useQuickCreateStore((s) => s.setActivePanel);

  const detailsOpen = activePanel === "task-details";
  const closeDetails = () => setActivePanel("base");

  const dueDate = useMemo(() => isoToDate(spanStart), [spanStart]);
  const dueTime = useMemo(() => isoToTime(spanStart), [spanStart]);

  // ---------- duration (Select + custom) ----------
  //
  // The dropdown shows preset values plus a "Custom…" sentinel. When the
  // current value isn't a preset (or the user explicitly picks Custom), we
  // render a `NumberInput` below the dropdown so they can enter an
  // arbitrary minute count. The recursion handles the case where the
  // stored value is already a custom minute count (e.g. after reopening
  // the panel), keeping the UI in sync.
  const durationMinutes = msToMin(durationMinMs);
  const isDurationPreset =
    durationMinutes > 0 &&
    DURATION_PRESETS_MIN.includes(
      durationMinutes as (typeof DURATION_PRESETS_MIN)[number],
    );

  // Whether the Select is currently displaying the Custom sentinel. Local
  // state — picking Custom doesn't change the store value, so deriving
  // from `isDurationPreset` alone would snap the dropdown back to e.g.
  // "30 min" before the user could interact with the NumberInput. The
  // store still holds the actual minute count (preset or custom).
  const [isCustomMode, setIsCustomMode] = useState(!isDurationPreset);

  const [customDuration, setCustomDuration] = useState<string | number>(
    isDurationPreset ? durationMinutes : durationMinutes || 30,
  );

  const DURATION_OPTIONS = useMemo(
    () => [
      ...DURATION_PRESETS_MIN.map((m) => ({
        value: String(m),
        label: m < 60 ? `${m} min` : `${m / 60} ${m === 60 ? "hour" : "hours"}`,
      })),
      {
        value: DURATION_CUSTOM_VALUE,
        label: t("quickCreate.durationCustom"),
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
      if (Number.isFinite(n) && n > 0) applyDuration(n);
    },
    [applyDuration],
  );
  const updateDueDate = useCallback(
    (value: string | null) => {
      const iso = value ? dateToIso(new Date(value)) : "";
      setField("time.span.start", iso);
      if (!spanEnd && iso) setField("time.span.end", iso);
      setField("time.whenMode", iso ? "day" : "none");
    },
    [setField, spanEnd],
  );

  const updateDueTime = useCallback(
    (next: string) => {
      const result = timeToIso(spanStart, next);
      if (result) setField("time.span.start", result);
    },
    [setField, spanStart],
  );

  // ---------- split policy (segmented, UI-only) ----------
  //
  // Wires `time.splitPolicy` to the segmented control. Submit does not
  // yet read this flag (the legacy editor maps the equivalent source
  // splitPolicy.kind elsewhere) so we keep the field visible but
  // intentionally do NOT add a mapping in this PR. The toggle stays
  // round-trippable through the store so a follow-up can wire the
  // submit side without re-touching the form.
  const splitPolicyOptions = useMemo(
    () => [
      { value: "split", label: t("quickCreate.splitAllow") },
      { value: "unsplit", label: t("quickCreate.splitKeep") },
    ],
    [t],
  );
  const handleSplitPolicyChange = useCallback(
    (next: string) => {
      setField("time.splitPolicy", next);
    },
    [setField],
  );

  return (
    <Stack gap={0} className="h-full">
      <Stack gap={0} className="flex-1 overflow-y-auto">
        <QuickCreateHeader
          value={title}
          onChange={(next) => setField("identity.title", next)}
          onClose={close}
          placeholder={t("quickCreate.titlePlaceholder")}
          closeTestId="quick-create-task-close"
          closeAriaLabel={t("quickCreate.cancel")}
          titleTestId="task-title"
          required
          autoFocus
        />
        <WorkflowBatch />

        {/* Duration — Select + Custom NumberInput (moved above due row per UX reorder 2026-08-14) */}
        <div className="px-4 py-3">
          <FormRow icon={<Timer className="h-4 w-4" aria-hidden />}>
            <div className="w-full">
              <Select
                value={selectedDuration}
                onChange={handleDurationChange}
                data={DURATION_OPTIONS}
                size="sm"
                aria-label={t("quickCreate.durationLabel")}
                data-testid="task-duration-select"
                allowDeselect={false}
                checkIconPosition="right"
                className="w-full"
              />
              {selectedDuration === DURATION_CUSTOM_VALUE ? (
                <NumberInput
                  value={customDuration}
                  onChange={handleCustomDurationChange}
                  suffix={` ${t("quickCreate.minutesUnit")}`}
                  min={1}
                  max={1440}
                  size="sm"
                  mt="xs"
                  aria-label={t("quickCreate.durationManual")}
                  placeholder={t("quickCreate.durationManual")}
                  data-testid="task-duration-manual"
                  className="w-full"
                />
              ) : null}
            </div>
          </FormRow>
        </div>

        {/* Split policy — Allow split / Keep continuous (segmented). UI-only wire-up; submit mapping is deferred. */}
        <div className="px-4 py-3">
          <RowSegmented
            icon={CalendarDays}
            options={splitPolicyOptions}
            value={splitPolicy}
            onChange={handleSplitPolicyChange}
            data-testid="task-split-policy"
          />
        </div>

        {/* Due date + Time — now third row (UX reorder 2026-08-14), with CalendarDays icon + "Due" leading label */}
        <div className="px-4 py-3">
          <FormRow
            icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            trailing={
              <TimeSuggestionInput
                value={dueTime}
                onChange={updateDueTime}
                aria-label={t("quickCreate.dueTimeLabel")}
                data-testid="task-due-time"
                className="w-[5.5rem]"
              />
            }
          >
            <DateInput
              value={dueDate}
              onChange={updateDueDate}
              valueFormat={DATE_FMT}
              placeholder={t("quickCreate.dueDatePlaceholder")}
              size="sm"
              clearable
              popoverProps={{ withinPortal: false }}
              data-testid="task-due-date"
              className="w-full"
            />
          </FormRow>
        </div>

        {/* "Task details" affordance — opens the task-details sub-panel */}
        <DetailsAffordanceButton
          panelKey="task-details"
          labelKey="quickCreate.detailsTaskTitle"
          fallbackLabel={t("quickCreate.detailsTaskTitle")}
          testId="task-open-details"
        />

        {/* Bottom "set": subtasks, project + color, then memo, grouped at the
            very bottom of every workflow form. The top border visually
            separates the set from the workflow-specific fields above. */}
        <div className="border-t border-border pt-1">
          {/* Subtasks — shared section component, lives ABOVE project+color so
              the user can edit checklist items without opening the sub-panel. */}
          <SubtasksSection testId="task-subtasks" />

          {/* Project picker + color swatches (shared section component) */}
          <ProjectColorRow
            pickerTestId="task-project-picker"
            colorTestId="task-color"
            swatches={TASK_COLOR_SWATCHES}
          />

          {/* Memo — borderless autosizing textarea bound to meta.memo.
              Sits directly under the project+color row (memo beneath project). */}
          <MemoSection testId="task-memo" />
        </div>
      </Stack>

      {createPortal(
        <TaskDetailsSubPanel
          opened={detailsOpen}
          onClose={closeDetails}
          durationMinMs={durationMinMs}
          durationMaxMs={durationMaxMs}
        />,
        document.body,
      )}
    </Stack>
  );
}
