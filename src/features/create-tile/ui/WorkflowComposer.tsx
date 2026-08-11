"use client";

import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { PlanRole, TileKind } from "@/tile/model/v1/constants";
import {
  Button,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateTimePicker, TimeInput } from "@mantine/dates";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Layers3,
  ListChecks,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { type KeyboardEvent, useRef } from "react";

type WorkflowMode = "anytime" | "scheduled" | "repeat";

interface WorkflowComposerProps {
  t: (key: string) => string;
  onOpenDetails: () => void;
}

const QUICK_DURATIONS = [15, 25, 50, 90] as const;
const WEEKDAY_BITS = [
  { bit: 0, key: "quickCreate.weekdayMon" },
  { bit: 1, key: "quickCreate.weekdayTue" },
  { bit: 2, key: "quickCreate.weekdayWed" },
  { bit: 3, key: "quickCreate.weekdayThu" },
  { bit: 4, key: "quickCreate.weekdayFri" },
  { bit: 5, key: "quickCreate.weekdaySat" },
  { bit: 6, key: "quickCreate.weekdaySun" },
] as const;

export interface WorkflowValidationInput {
  kind: number;
  repeatMode: string;
  whenMode: string;
  spanStart: string;
  recurringTime: string;
  weekdayMask: number;
}

export interface WorkflowValidationError {
  path: string;
  messageKey: string;
}

/**
 * Keep the workflow guard close to the fields it protects.  The submit path
 * still builds the canonical v1 schedule payload; this only prevents an
 * incomplete calendar intent from reaching that path.
 */
export function getWorkflowValidation(
  input: WorkflowValidationInput,
): WorkflowValidationError | null {
  const mode = getWorkflowMode(input.kind, input.repeatMode, input.whenMode);
  if (mode === "scheduled" && !input.spanStart) {
    return { path: "time.span.start", messageKey: "quickCreate.workflowStartRequired" };
  }
  if (mode !== "repeat") return null;
  if (!["daily", "weekly"].includes(input.repeatMode)) {
    return { path: "recurring.repeatMode", messageKey: "quickCreate.workflowRepeatPatternRequired" };
  }
  if (["daily", "weekly"].includes(input.repeatMode) && !input.recurringTime) {
    return { path: "time.timeOfDayStart", messageKey: "quickCreate.workflowRecurringTimeRequired" };
  }
  if (input.repeatMode === "weekly" && input.weekdayMask === 0) {
    return { path: "recurring.weekdayMask", messageKey: "quickCreate.workflowWeekdayRequired" };
  }
  return null;
}

function getWorkflowMode(kind: number, repeatMode: string, whenMode: string): WorkflowMode {
  if (kind === TileKind.RECURRING || repeatMode !== "once") return "repeat";
  if (whenMode !== "none") return "scheduled";
  return "anytime";
}

function nextRadioIndex(key: string, index: number, count: number): number {
  const direction =
    key === "ArrowRight" || key === "ArrowDown"
      ? 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? -1
        : 0;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (direction === 0) return index;
  return (index + direction + count) % count;
}

function timeFromIso(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function localAnchorForTime(current: string, timeValue: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeValue);
  if (!match) return current;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return current;
  const datePart = /^\d{4}-\d{2}-\d{2}/.exec(current)?.[0];
  const candidate = datePart
    ? new Date(`${datePart}T${timeValue}:00`)
    : current
      ? new Date(current)
      : new Date();
  if (Number.isNaN(candidate.getTime())) return current;
  candidate.setHours(hour, minute, 0, 0);
  return candidate.toISOString();
}

const SELECTOR_CARD_BASE =
  "relative cursor-pointer rounded-md border border-transparent bg-surface-0 p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2";
const SELECTOR_CARD_SELECTED = "bg-accent-soft text-foreground";
const SELECTOR_CARD_UNSELECTED = "text-foreground hover:bg-surface-2";
const SELECTOR_BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-surface-0 px-3 py-2 text-sm font-medium text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2";

export function WorkflowComposer({ t, onOpenDetails }: WorkflowComposerProps) {
  const identity = useQuickCreateStore((state) => state.identity);
  const plan = useQuickCreateStore((state) => state.plan);
  const time = useQuickCreateStore((state) => state.time);
  const recurring = useQuickCreateStore((state) => state.recurring);
  const setField = useQuickCreateStore((state) => state.setField);
  const setLabelOnly = useQuickCreateStore((state) => state.setLabelOnly);
  const addTask = useQuickCreateStore((state) => state.addTask);
  const removeTask = useQuickCreateStore((state) => state.removeTask);
  const setTaskField = useQuickCreateStore((state) => state.setTaskField);
  const timingRadioRefs = useRef<Array<HTMLInputElement | null>>([]);
  const typeRadioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cadenceRadioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const durationRadioRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const workflowMode = getWorkflowMode(identity.kind, recurring.repeatMode, time.whenMode);
  const durationMinutes =
    time.durationMinMax.minMs === null ? "" : Math.round(time.durationMinMax.minMs / 60_000);
  const durationPresetIndex = QUICK_DURATIONS.findIndex((minutes) => durationMinutes === minutes);

  function setWorkflowMode(mode: WorkflowMode) {
    if (mode === "repeat") {
      setField("identity.kind", TileKind.RECURRING);
      if (recurring.repeatMode === "once") setField("recurring.repeatMode", "daily");
      setField("time.whenMode", "none");
      setField("time.span.end", "");
      const next = time.timeOfDayStart || timeFromIso(time.span.start) || "09:00";
      setField("time.timeOfDayMode", "range");
      setField("time.timeOfDayStart", next);
      setField("time.span.start", localAnchorForTime(time.span.start, next));
      return;
    }

    setField("identity.kind", TileKind.PLACEMENT);
    setField("recurring.repeatMode", "once");
    if (mode === "scheduled") {
      setField("time.whenMode", "day");
      setField("time.span.start", "");
      setField("time.span.end", "");
      setField("time.timeOfDayMode", "unspecified");
      setField("time.timeOfDayStart", "");
      setField("time.timeOfDayEnd", "");
      return;
    }

    setField("time.whenMode", "none");
    setField("time.span.start", "");
    setField("time.span.end", "");
    setField("time.timeOfDayMode", "unspecified");
    setField("time.timeOfDayStart", "");
    setField("time.timeOfDayEnd", "");
  }

  function handleTimingKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    const key = event.key;
    const nextIndex = nextRadioIndex(key, index, 3);
    if (nextIndex === index && key !== "Home" && key !== "End") return;
    event.preventDefault();
    const nextMode = ["anytime", "scheduled", "repeat"][nextIndex] as WorkflowMode;
    setWorkflowMode(nextMode);
    timingRadioRefs.current[nextIndex]?.focus();
  }

  function handleDurationKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const key = event.key;
    const nextIndex = nextRadioIndex(key, index, QUICK_DURATIONS.length);
    if (nextIndex === index && key !== "Home" && key !== "End") return;
    event.preventDefault();
    setDuration(QUICK_DURATIONS[nextIndex]);
    durationRadioRefs.current[nextIndex]?.focus();
  }

  function setDuration(minutes: number | string) {
    const parsed = typeof minutes === "number" ? minutes : Number(minutes);
    const durationMs = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 60_000) : null;
    setField("time.durationMinMax.minMs", durationMs);
    setField("time.durationMinMax.maxMs", durationMs);
  }

  function toggleWeekday(bit: number) {
    setField("recurring.weekdayMask", recurring.weekdayMask ^ (1 << bit));
  }

  function setRecurringTime(next: string) {
    setField("time.timeOfDayMode", "range");
    setField("time.timeOfDayStart", next);
    setField("time.span.start", localAnchorForTime(time.span.start, next));
  }

  function ensureRecurringTime() {
    const next = time.timeOfDayStart || timeFromIso(time.span.start) || "09:00";
    setRecurringTime(next);
  }

  function handleTypeKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const nextIndex = nextRadioIndex(event.key, index, 2);
    if (nextIndex === index) return;
    event.preventDefault();
    const nextRole = nextIndex === 0 ? PlanRole.EXECUTABLE : PlanRole.LABEL;
    setLabelOnly(nextRole === PlanRole.LABEL);
    typeRadioRefs.current[nextIndex]?.focus();
  }

  function handleCadenceKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const nextIndex = nextRadioIndex(event.key, index, 2);
    if (nextIndex === index) return;
    event.preventDefault();
    const nextMode = ["daily", "weekly"][nextIndex] ?? "daily";
    setField("identity.kind", TileKind.RECURRING);
    setField("recurring.repeatMode", nextMode);
    if (nextMode === "weekly" && recurring.weekdayMask === 0) {
      setField("recurring.weekdayMask", 1);
    }
    ensureRecurringTime();
    cadenceRadioRefs.current[nextIndex]?.focus();
  }

  const recurringTime = time.timeOfDayStart || timeFromIso(time.span.start);

  return (
    <Stack gap="xl" data-testid="workflow-composer">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-accent">
          <Sparkles size={16} aria-hidden="true" />
          <Text component="h3" fw={650} size="lg">
            {t("quickCreate.workflowTitle")}
          </Text>
        </div>
        <Text c="dimmed" size="sm">
          {t("quickCreate.workflowIntro")}
        </Text>
      </header>

      <section className="space-y-3" aria-labelledby="workflow-purpose-heading">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            1
          </span>
          <div>
            <Text id="workflow-purpose-heading" fw={600} size="sm">
              {t("quickCreate.workflowPurpose")}
            </Text>
            <Text c="dimmed" size="xs">
              {t("quickCreate.workflowPurposeHint")}
            </Text>
          </div>
        </div>

        <TextInput
          value={identity.title}
          onChange={(event) => setField("identity.title", event.currentTarget.value)}
          placeholder={t("quickCreate.workflowTitleLabel")}
          size="md"
          radius="sm"
          autoFocus
          data-testid="workflow-title-input"
          aria-label={t("quickCreate.workflowTitleLabel")}
        />
        <Textarea
          value={identity.description ?? ""}
          onChange={(event) => setField("identity.description", event.currentTarget.value)}
          placeholder={t("quickCreate.workflowNotePlaceholder")}
          rows={3}
          radius="sm"
          aria-label={t("quickCreate.workflowNotePlaceholder")}
        />

        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label={t("quickCreate.workflowTypeLabel")}
          data-testid="workflow-type-group"
        >
          {(
            [
              [PlanRole.EXECUTABLE, "quickCreate.workflowExecutable"],
              [PlanRole.LABEL, "quickCreate.workflowTimeBlock"],
            ] as const
          ).map(([role, labelKey], index) => {
            const selected = plan.role === role;
            return (
              <button
                key={role}
                ref={(element) => {
                  typeRadioRefs.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setLabelOnly(role === PlanRole.LABEL)}
                onKeyDown={(event) => handleTypeKeyDown(event, index)}
                className={`${SELECTOR_BUTTON_BASE} ${selected ? SELECTOR_CARD_SELECTED : SELECTOR_CARD_UNSELECTED}`}
              >
                {selected ? <Check size={15} aria-hidden="true" /> : null}
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="workflow-timing-heading">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            2
          </span>
          <div>
            <Text id="workflow-timing-heading" fw={600} size="sm">
              {t("quickCreate.workflowTiming")}
            </Text>
            <Text c="dimmed" size="xs">
              {t("quickCreate.workflowTimingHint")}
            </Text>
          </div>
        </div>

        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-labelledby="workflow-timing-heading"
          data-testid="workflow-timing-group"
        >
          {(
            [
              ["anytime", Clock3, "quickCreate.workflowAnytime", "quickCreate.workflowAnytimeHint"],
              [
                "scheduled",
                CalendarClock,
                "quickCreate.workflowScheduled",
                "quickCreate.workflowScheduledHint",
              ],
              ["repeat", Repeat2, "quickCreate.workflowRepeat", "quickCreate.workflowRepeatHint"],
            ] as const
          ).map(([mode, Icon, labelKey, hintKey]) => {
            const selected = workflowMode === mode;
            const inputId = `workflow-mode-${mode}`;
            return (
              <label
                key={mode}
                htmlFor={inputId}
                className={`${SELECTOR_CARD_BASE} ${
                  selected ? SELECTOR_CARD_SELECTED : SELECTOR_CARD_UNSELECTED
                } pr-9`}
              >
                <input
                  ref={(element) => {
                    timingRadioRefs.current[mode === "anytime" ? 0 : mode === "scheduled" ? 1 : 2] = element;
                  }}
                  id={inputId}
                  type="radio"
                  name="workflow-timing"
                  value={mode}
                  checked={selected}
                  onChange={() => setWorkflowMode(mode)}
                  onKeyDown={(event) =>
                    handleTimingKeyDown(event, mode === "anytime" ? 0 : mode === "scheduled" ? 1 : 2)
                  }
                  tabIndex={selected ? 0 : -1}
                  aria-checked={selected}
                  data-testid={inputId}
                  className="sr-only"
                />
                <Icon size={17} className={selected ? "text-accent" : "text-foreground-muted"} />
                <span className="mt-2 block text-sm font-semibold">{t(labelKey)}</span>
                <span className="mt-0.5 block text-xs leading-snug text-foreground-muted">
                  {t(hintKey)}
                </span>
                {selected ? (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-accent text-primary-fg">
                    <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                    <span className="sr-only">{t("quickCreate.workflowSelected")}</span>
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>

        {workflowMode === "scheduled" ? (
          <div className="rounded-md border border-border bg-surface-1 p-3">
            <DateTimePicker
              value={time.span.start || null}
              onChange={(value) => setField("time.span.start", value ?? "")}
              label={t("quickCreate.workflowStart")}
              placeholder={t("quickCreate.workflowStartPlaceholder")}
              radius="sm"
              clearable
              required
              data-testid="workflow-start-input"
            />
            {!time.span.start ? (
              <Text c="red" size="xs" role="alert" data-testid="workflow-start-error" className="mt-2">
                {t("quickCreate.workflowStartRequired")}
              </Text>
            ) : null}
          </div>
        ) : null}

        {workflowMode === "repeat" ? (
          <div className="space-y-3 rounded-md border border-border bg-surface-1 p-3">
            <div
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              role="radiogroup"
              aria-label={t("quickCreate.workflowRepeatPattern")}
              data-testid="workflow-repeat-pattern-group"
            >
              {[
                ["daily", "quickCreate.workflowDaily"],
                ["weekly", "quickCreate.workflowWeekly"],
              ].map(([mode, labelKey], index) => {
                const selected = (recurring.repeatMode === "once" ? "daily" : recurring.repeatMode) === mode;
                return (
                  <button
                    key={mode}
                    ref={(element) => {
                      cadenceRadioRefs.current[index] = element;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => {
                      setField("identity.kind", TileKind.RECURRING);
                      setField("recurring.repeatMode", mode);
                      if (mode === "weekly" && recurring.weekdayMask === 0) {
                        setField("recurring.weekdayMask", 1);
                      }
                      ensureRecurringTime();
                    }}
                    onKeyDown={(event) => handleCadenceKeyDown(event, index)}
                    className={`${SELECTOR_BUTTON_BASE} ${selected ? SELECTOR_CARD_SELECTED : SELECTOR_CARD_UNSELECTED}`}
                  >
                    {selected ? <Check size={15} aria-hidden="true" /> : null}
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="workflow-recurring-time-input" className="text-sm font-medium text-foreground">
                {t("quickCreate.workflowRecurringTime")}
              </label>
              <TimeInput
                id="workflow-recurring-time-input"
                value={recurringTime}
                onChange={(event) => setRecurringTime(event.currentTarget.value)}
                required
                aria-label={t("quickCreate.workflowRecurringTime")}
                data-testid="workflow-recurring-time-input"
              />
              <Text c="dimmed" size="xs">
                {t("quickCreate.workflowRecurringTimeHint")}
              </Text>
              {!recurringTime ? (
                <Text c="red" size="xs" role="alert" data-testid="workflow-recurring-time-error">
                  {t("quickCreate.workflowRecurringTimeRequired")}
                </Text>
              ) : null}
            </div>

            {recurring.repeatMode === "weekly" ? (
              <div className="space-y-1.5" role="group" aria-label={t("quickCreate.workflowWeekdays")}>
                <Text size="sm" fw={500}>{t("quickCreate.workflowWeekdays")}</Text>
                <Group gap={6} wrap="wrap">
                  {WEEKDAY_BITS.map(({ bit, key }) => {
                    const selected = Boolean(recurring.weekdayMask & (1 << bit));
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`${SELECTOR_BUTTON_BASE} ${
                          selected ? SELECTOR_CARD_SELECTED : SELECTOR_CARD_UNSELECTED
                        } px-2.5 py-1.5 text-xs`}
                        onClick={() => toggleWeekday(bit)}
                        aria-pressed={selected}
                      >
                        {selected ? <Check size={13} aria-hidden="true" /> : null}
                        {t(key)}
                      </button>
                    );
                  })}
                </Group>
                {recurring.weekdayMask === 0 ? (
                  <Text c="red" size="xs" role="alert" data-testid="workflow-weekday-error">
                    {t("quickCreate.workflowWeekdayRequired")}
                  </Text>
                ) : null}
              </div>
            ) : null}
            {!['daily', 'weekly'].includes(recurring.repeatMode) ? (
              <Text c="red" size="xs" role="alert" data-testid="workflow-repeat-pattern-error">
                {t("quickCreate.workflowRepeatPatternRequired")}
              </Text>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="workflow-duration-heading">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            3
          </span>
          <div>
            <Text id="workflow-duration-heading" fw={600} size="sm">
              {t("quickCreate.workflowDuration")}
            </Text>
            <Text c="dimmed" size="xs">
              {t("quickCreate.workflowDurationHint")}
            </Text>
          </div>
        </div>

        <Group gap="xs" wrap="wrap">
          <div
            className="flex flex-wrap items-center gap-2"
            role="radiogroup"
            aria-label={t("quickCreate.workflowDuration")}
            data-testid="workflow-duration-group"
          >
            {QUICK_DURATIONS.map((minutes, index) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setDuration(minutes)}
                data-testid={`workflow-duration-${minutes}`}
                role="radio"
                aria-checked={durationMinutes === minutes}
                tabIndex={
                  durationMinutes === minutes || (durationPresetIndex === -1 && index === 0)
                    ? 0
                    : -1
                }
                ref={(element) => {
                  durationRadioRefs.current[index] = element;
                }}
                onKeyDown={(event) => handleDurationKeyDown(event, index)}
                className={`${SELECTOR_BUTTON_BASE} ${
                  durationMinutes === minutes ? SELECTOR_CARD_SELECTED : SELECTOR_CARD_UNSELECTED
                } px-2.5 py-1.5 text-xs`}
              >
                {minutes} {t("quickCreate.workflowMinutes")}
              </button>
            ))}
          </div>
          <NumberInput
            value={durationMinutes}
            onChange={setDuration}
            min={1}
            max={10_080}
            suffix={` ${t("quickCreate.workflowMinutes")}`}
            placeholder={t("quickCreate.workflowCustomDuration")}
            hideControls
            w={150}
            aria-label={t("quickCreate.workflowCustomDuration")}
          />
        </Group>
      </section>

      {plan.role === PlanRole.EXECUTABLE ? (
        <section className="space-y-3" aria-labelledby="workflow-completion-heading">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              4
            </span>
            <div>
              <Text id="workflow-completion-heading" fw={600} size="sm">
                {t("quickCreate.workflowCompletion")}
              </Text>
              <Text c="dimmed" size="xs">
                {t("quickCreate.workflowCompletionHint")}
              </Text>
            </div>
          </div>

          <Stack gap="xs">
            {plan.completion.tasks.map((task, index) => (
              <div key={task.id} className="flex items-center gap-2">
                {index === 0 ? (
                  <CheckCircle2 size={16} className="shrink-0 text-accent" aria-hidden="true" />
                ) : (
                  <ListChecks size={16} className="shrink-0 text-foreground-muted" aria-hidden="true" />
                )}
                <TextInput
                  value={
                    task.content.title === "Mark done"
                      ? t("quickCreate.workflowDefaultStep")
                      : task.content.title
                  }
                  onChange={(event) =>
                    setTaskField(task.id, "content.title", event.currentTarget.value)
                  }
                  placeholder={t("quickCreate.workflowStepPlaceholder")}
                  className="min-w-0 flex-1"
                  aria-label={`${t("quickCreate.workflowStep")} ${index + 1}`}
                />
                {plan.completion.tasks.length > 1 ? (
                  <Button type="button" variant="subtle" onClick={() => removeTask(task.id)}>
                    {t("quickCreate.remove")}
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="light"
              leftSection={<ListChecks size={15} />}
              onClick={() => addTask("")}
              className="self-start"
            >
              {t("quickCreate.workflowAddStep")}
            </Button>
          </Stack>
        </section>
      ) : null}

      <button
        type="button"
        onClick={onOpenDetails}
        aria-label={t("quickCreate.workflowDetails")}
        className="group flex w-full items-center gap-3 rounded-md border border-border bg-surface-1 p-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-3 text-foreground-muted">
          <Layers3 size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {t("quickCreate.workflowDetails")}
          </span>
          <span className="block text-xs text-foreground-muted">
            {t("quickCreate.workflowDetailsHint")}
          </span>
        </span>
        <ChevronRight
          size={17}
          className="shrink-0 text-foreground-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </Stack>
  );
}
