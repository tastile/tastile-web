"use client";

import {
  Button,
  CloseButton,
  ColorInput,
  Select,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  FileText,
  Folder,
  Timer,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { ProjectPicker } from "./ProjectPicker";
import { TaskDetailsSubPanel } from "./TaskDetailsSubPanel";
import { TimeSuggestionInput } from "./TimeSuggestionInput";
import { WorkflowBatch } from "./WorkflowBatch";

const DURATION_OPTIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
] as const;

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
 *   - Description / memo (borderless textarea)
 *   - Color row (compact swatches)
 *   - Project picker (chip row)
 *   - "Task details" affordance (sub-panel: sub-tasks + refs)
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
  const mode = useQuickCreateStore((s) => s.mode);

  const spanStart = useQuickCreateStore((s) => s.time.span.start);
  const spanEnd = useQuickCreateStore((s) => s.time.span.end);
  const durationMinMs = useQuickCreateStore((s) => s.time.durationMinMax.minMs);
  const durationMaxMs = useQuickCreateStore((s) => s.time.durationMinMax.maxMs);
  const memo = useQuickCreateStore((s) => s.meta.memo);
  const visualColor = useQuickCreateStore((s) => s.identity.visual.color);
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const setActivePanel = useQuickCreateStore((s) => s.setActivePanel);

  const detailsOpen = activePanel === "task-details";
  const openDetails = () => setActivePanel("task-details");
  const closeDetails = () => setActivePanel("base");

  const dueDate = useMemo(() => isoToDate(spanStart), [spanStart]);
  const dueTime = useMemo(() => isoToTime(spanStart), [spanStart]);

  const selectedDuration = useMemo(() => {
    const m = msToMin(durationMinMs);
    return DURATION_OPTIONS.find((o) => Number(o.value) === m)?.value ?? "30";
  }, [durationMinMs]);

  const applyDuration = useCallback(
    (value: string | null) => {
      if (!value) return;
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes <= 0) return;
      setField("time.durationMinMax.minMs", minToMs(minutes));
      setField("time.durationMinMax.maxMs", minToMs(minutes));
    },
    [setField],
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
                data-testid="quick-create-task-close"
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
              data-testid="task-title"
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

        {/* Due date + Time */}
        <div className="px-4 py-3">
          <FormRow
            trailing={
              <TimeSuggestionInput
                value={dueTime}
                onChange={updateDueTime}
                aria-label={t("quickCreate.dueTimeLabel") || "Due time"}
                data-testid="task-due-time"
                className="w-[5.5rem]"
              />
            }
          >
            <DateInput
              value={dueDate}
              onChange={updateDueDate}
              valueFormat={DATE_FMT}
              placeholder={t("quickCreate.dueDatePlaceholder") || "Date (optional)"}
              size="sm"
              clearable
              popoverProps={{ withinPortal: false }}
              data-testid="task-due-date"
              className="w-full"
            />
          </FormRow>
        </div>

        {/* Duration */}
        <div className="px-4 py-3">
          <FormRow icon={<Timer className="h-4 w-4" aria-hidden />}>
            <Select
              value={selectedDuration}
              onChange={applyDuration}
              data={[...DURATION_OPTIONS]}
              size="xs"
              aria-label={t("quickCreate.durationLabel") || "Duration"}
              data-testid="task-duration-select"
              allowDeselect={false}
              checkIconPosition="right"
            />
          </FormRow>
        </div>

        {/* Memo — full width with a bottom border to make the input affordance obvious */}
        <div className="px-4 py-3">
          <FormRow icon={<FileText className="h-4 w-4" aria-hidden />}>
            <Textarea
              placeholder={t("quickCreate.memoPlaceholder") || "Add a note"}
              value={memo}
              onChange={(e) => setField("meta.memo", e.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={6}
              size="sm"
              variant="unstyled"
              data-testid="task-memo"
              // Visible bottom underline is enforced by a CSS rule in
              // `src/app/globals.css` (`.qc-underline-input--muted`) — Mantine's
              // module-class shorthand border otherwise wins over Tailwind.
              classNames={{
                input:
                  "qc-underline-input--muted bg-transparent text-sm leading-relaxed text-foreground placeholder:text-[var(--foreground-muted)] px-0 w-full",
              }}
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
                swatches={TASK_COLOR_SWATCHES}
                data-testid="task-color"
                className="w-[120px]"
              />
            }
          >
            <ProjectPicker testId="task-project-picker" />
          </FormRow>
        </div>

        {/* Details affordance */}
        <div className="px-4 py-3">
          <FormRow icon={<FileText className="h-4 w-4" aria-hidden />}>
            <Button
              variant="default"
              size="sm"
              onClick={openDetails}
              data-testid="task-open-details"
              fullWidth
              className="w-full"
            >
              {t("quickCreate.detailsTaskTitle") || "Task details"}
            </Button>
          </FormRow>
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
