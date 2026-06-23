"use client";

import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Clock4,
  StopCircle,
  Timer,
  Type,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { getSessionClient } from "@/lib/daemon/id-token-client";
import { Actor } from "@/lib/domain/actor";
import { TileId } from "@/lib/domain/ids";
import { type DoneRule, type ObjectiveMode, Tile } from "@/lib/domain/tile";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";

export function QuickTileCreate() {
  const { isOpen, close } = useQuickCreateStore();
  const isDesktop = useIsDesktop();
  const { t, locale } = useTranslation();
  const { state, execute } = useExecutionEngineContext();

  const [activePanel, setActivePanel] = useState<
    "base" | "recurrence" | "interrupt" | "automation" | "meta"
  >("base");

  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [isLabelOnly, setIsLabelOnly] = useState(false);
  const [useStartAt, setUseStartAt] = useState(false);
  const [useEndAt, setUseEndAt] = useState(false);
  const [startDateInput, setStartDateInput] = useState(() => getCurrentLocalDate());
  const [startTimeInput, setStartTimeInput] = useState(() => getCurrentLocalTime());
  const [endDateInput, setEndDateInput] = useState(() => getCurrentLocalDate());
  const [endTimeInput, setEndTimeInput] = useState(() => getLocalTimeAfterMinutes(60));
  const [objectiveMode, setObjectiveMode] = useState<ObjectiveMode>("finish_once");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<"daily" | "weekly" | "monthly">(
    "daily",
  );
  const [recurrenceIntervalInput, setRecurrenceIntervalInput] = useState("1");
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([new Date().getDay()]);
  const [recurrenceMonthlyWeekInput, setRecurrenceMonthlyWeekInput] = useState("1");
  const [recurrenceMonthlyWeekdayInput, setRecurrenceMonthlyWeekdayInput] = useState(
    String(new Date().getDay()),
  );
  const [recurrenceUseStartAt, setRecurrenceUseStartAt] = useState(true);
  const [recurrenceUseEndAt, setRecurrenceUseEndAt] = useState(true);
  const [recurrenceStartTimeInput, setRecurrenceStartTimeInput] = useState(() =>
    getCurrentLocalTime(),
  );
  const [recurrenceEndTimeInput, setRecurrenceEndTimeInput] = useState(() =>
    getLocalTimeAfterMinutes(60),
  );
  const [recurrenceValidFromEnabled, setRecurrenceValidFromEnabled] = useState(false);
  const [recurrenceValidToEnabled, setRecurrenceValidToEnabled] = useState(false);
  const [recurrenceValidFromDateInput, setRecurrenceValidFromDateInput] = useState(() =>
    getCurrentLocalDate(),
  );
  const [recurrenceValidToDateInput, setRecurrenceValidToDateInput] = useState(() =>
    getCurrentLocalDate(),
  );
  const [workHoursInput, setWorkHoursInput] = useState("0");
  const [workMinutesInput, setWorkMinutesInput] = useState("25");
  const [durationManuallyEdited, setDurationManuallyEdited] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState("");
  const [isProjectInputFocused, setIsProjectInputFocused] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const [memoInput, setMemoInput] = useState("");
  const [doneRule, setDoneRule] = useState<DoneRule>("manual");
  const [interruptPenalty, setInterruptPenalty] = useState(3);
  const [resumePenalty, setResumePenalty] = useState(3);
  const [externalInterruptOnly, setExternalInterruptOnly] = useState(false);
  const [promptOnStart, setPromptOnStart] = useState(false);
  const [promptOnEnd, setPromptOnEnd] = useState(true);
  const [autoStartAllowed, setAutoStartAllowed] = useState(false);
  const [autoEndAllowed, setAutoEndAllowed] = useState(false);
  const [timezone, setTimezone] = useState("");
  const [timedLabelDraft, setTimedLabelDraft] = useState("");
  const [timedLabels, setTimedLabels] = useState<
    Array<{ label: string; startAt: Date | null; endAt: Date | null }>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workTargetMin = parseDurationToMinutes(workHoursInput, workMinutesInput);
  const boundedDurationMin = parseBoundedDurationMinutes(
    startDateInput,
    startTimeInput,
    endDateInput,
    endTimeInput,
  );
  const recurrenceStartOffsetMin = parseTimeToMinutes(recurrenceStartTimeInput);
  const recurrenceEndOffsetMin = parseTimeToMinutes(recurrenceEndTimeInput);
  const recurringWindowDurationMin =
    recurrenceUseStartAt &&
    recurrenceUseEndAt &&
    recurrenceStartOffsetMin !== null &&
    recurrenceEndOffsetMin !== null &&
    recurrenceEndOffsetMin > recurrenceStartOffsetMin
      ? recurrenceEndOffsetMin - recurrenceStartOffsetMin
      : null;
  const effectiveDurationMin =
    recurringWindowDurationMin && !durationManuallyEdited
      ? recurringWindowDurationMin
      : boundedDurationMin && !durationManuallyEdited
        ? boundedDurationMin
        : (workTargetMin ?? boundedDurationMin);
  const workTargetText = effectiveDurationMin ? formatDuration(effectiveDurationMin, locale) : null;

  const startDate = useStartAt ? parseDateTimeParts(startDateInput, startTimeInput) : null;
  const endDate = useEndAt ? parseDateTimeParts(endDateInput, endTimeInput) : null;
  const hasStart = !!startDate;
  const hasEnd = !!endDate;
  const hasAnyTemporalConstraint = hasStart || hasEnd;
  const isRecurring = objectiveMode === "recurring";
  const showFocusUntilEnd = !isLabelOnly && !isRecurring && hasEnd;
  const recurrenceInterval = parseNonNegativeInt(recurrenceIntervalInput) ?? 0;
  const recurrenceWindowValid =
    !recurrenceUseStartAt ||
    !recurrenceUseEndAt ||
    (recurrenceStartOffsetMin !== null &&
      recurrenceEndOffsetMin !== null &&
      recurrenceEndOffsetMin > recurrenceStartOffsetMin);
  const { existingProjects, existingTags } = deriveProjectAndTags(state);
  const projectSuggestions = existingProjects
    .filter((project) => project.toLowerCase().includes(projectDraft.trim().toLowerCase()))
    .slice(0, 8);
  const tagSuggestions = existingTags
    .filter(
      (tag) =>
        tag.toLowerCase().includes(tagDraft.trim().toLowerCase()) &&
        !selectedTags.some((selected) => equalsIgnoreCase(selected, tag)),
    )
    .slice(0, 8);

  const suggestedTitle = (() => {
    if (isLabelOnly) {
      return locale === "ja" ? "期間ラベル" : "Period label";
    }

    if (objectiveMode === "recurring") {
      if (workTargetText)
        return locale === "ja"
          ? `定期タスク ${workTargetText}`
          : `Recurring task ${workTargetText}`;
      return locale === "ja" ? "定期タスク" : "Recurring task";
    }

    if (objectiveMode === "maximize_within_interval" && showFocusUntilEnd) {
      if (startDate && endDate) {
        return locale === "ja"
          ? `${formatDateShort(startDate, locale)} - ${formatDateShort(endDate, locale)} で最大化`
          : `Maximize in ${formatDateShort(startDate, locale)} - ${formatDateShort(endDate, locale)}`;
      }
      return locale === "ja" ? "できる限り進める" : "Maximize progress";
    }

    if (workTargetText)
      return locale === "ja" ? `作業 ${workTargetText}` : `Task ${workTargetText}`;
    return locale === "ja" ? "作業タスク" : "Task";
  })();

  useEffect(() => {
    if (!titleEdited) {
      setTitle(suggestedTitle);
    }
  }, [suggestedTitle, titleEdited]);

  useEffect(() => {
    if (!showFocusUntilEnd && objectiveMode === "maximize_within_interval") {
      setObjectiveMode("finish_once");
    }
  }, [showFocusUntilEnd, objectiveMode]);

  useEffect(() => {
    const autoDerived = recurringWindowDurationMin ?? boundedDurationMin;
    if (autoDerived && !durationManuallyEdited) {
      const { hours, minutes } = minutesToHourMinuteStrings(autoDerived);
      setWorkHoursInput(hours);
      setWorkMinutesInput(minutes);
    }
  }, [boundedDurationMin, recurringWindowDurationMin, durationManuallyEdited]);

  // WYSIWYG: when the user picks a condition that lives in a sub-panel,
  // open that panel so the controls are visible without a second click.
  // (Schedule / Period label / Project / Memo now live in the base panel
  // and need no auto-navigation.)
  useEffect(() => {
    if (objectiveMode === "recurring" && activePanel === "base") {
      setActivePanel("recurrence");
    }
  }, [objectiveMode, activePanel]);

  if (!isOpen) return null;

  const temporalOrderValid = isRecurring
    ? recurrenceWindowValid
    : !startDate || !endDate || endDate.getTime() > startDate.getTime();
  const durationReady = isLabelOnly
    ? true
    : isRecurring
      ? (workTargetMin ?? 0) > 0
      : !hasAnyTemporalConstraint || (workTargetMin ?? 0) > 0;
  const recurrenceReady = !isRecurring || recurrenceInterval > 0;
  const canSubmit =
    title.trim().length > 0 && temporalOrderValid && durationReady && recurrenceReady;
  const normalizedProjectDraft = normalizeTag(projectDraft);
  const resolvedProject =
    selectedProject ??
    (normalizedProjectDraft
      ? (existingProjects.find((project) => equalsIgnoreCase(project, normalizedProjectDraft)) ??
        normalizedProjectDraft)
      : "");

  const doneDefinition = (() => {
    if (isLabelOnly) {
      return locale === "ja"
        ? "指定した期間のラベル付けを完了"
        : "Complete labeling for the selected period";
    }

    if (objectiveMode === "recurring") {
      return locale === "ja" ? "1サイクル実行したら完了（定期）" : "Complete one cycle (recurring)";
    }

    if (objectiveMode === "maximize_within_interval") {
      if (startDate && endDate) {
        return locale === "ja"
          ? `${formatDateShort(startDate, locale)} から ${formatDateShort(endDate, locale)} の間で最大化`
          : `Maximize progress from ${formatDateShort(startDate, locale)} to ${formatDateShort(endDate, locale)}`;
      }
      return locale === "ja" ? "できる限り進める" : "Maximize progress";
    }

    if (workTargetText) {
      return locale === "ja"
        ? `${workTargetText}の実行を完了`
        : `Complete ${workTargetText} of work`;
    }

    return locale === "ja" ? "1回の実行を完了" : "Complete one run";
  })();

  async function handleCreate() {
    setError(null);
    if (title.trim().length === 0) {
      setError(t("quickCreate.titleRequired"));
      return;
    }
    if (!temporalOrderValid) {
      setError(t("quickCreate.invalidTemporalOrder"));
      return;
    }

    if (!isLabelOnly && !isRecurring && hasAnyTemporalConstraint && (workTargetMin ?? 0) <= 0) {
      setError(t("quickCreate.durationRequired"));
      return;
    }
    if (objectiveMode === "recurring" && recurrenceInterval <= 0) {
      setError(t("quickCreate.recurrenceStepRequired"));
      return;
    }

    if (!canSubmit) return;

    const tileId = TileId.new();
    const tile = Tile.create(tileId, title.trim());
    if (isLabelOnly) {
      tile.objective.objectiveMode = "label_only";
      tile.objective.targetWorkMin = null;
      tile.objective.targetRestMin = null;
      tile.objective.doneRule = null;
    } else {
      tile.objective.objectiveMode = objectiveMode;
      tile.objective.targetWorkMin = effectiveDurationMin;
      tile.objective.targetRestMin = null;
      tile.objective.doneRule = doneRule;
    }
    const recurrenceAnchorDate = recurrenceValidFromEnabled
      ? parseDateTimeParts(recurrenceValidFromDateInput, "00:00")
      : null;
    tile.objective.recurrence =
      objectiveMode === "recurring" && !isLabelOnly
        ? {
            generator: {
              kind: "time_based",
              step_min:
                recurrenceInterval *
                (recurrenceFrequency === "weekly"
                  ? 7 * 24 * 60
                  : recurrenceFrequency === "monthly"
                    ? 30 * 24 * 60
                    : 24 * 60),
              anchor_epoch_min: recurrenceAnchorDate
                ? Math.floor(recurrenceAnchorDate.getTime() / 60000)
                : null,
            },
            window: {
              weekday_mask: weekdaysToBitmask(recurrenceWeekdays),
              start_offset_min:
                recurrenceUseStartAt && recurrenceStartOffsetMin !== null
                  ? recurrenceStartOffsetMin
                  : 0,
              end_offset_min:
                recurrenceUseEndAt && recurrenceEndOffsetMin !== null
                  ? recurrenceEndOffsetMin
                  : 1440,
              exclusions: [],
            },
            selector: {
              expression: null,
            },
          }
        : null;
    tile.core.doneDefinition = doneDefinition;
    tile.annotation.labels = buildLabels(resolvedProject, selectedTags);
    tile.annotation.timedLabels = timedLabels
      .filter((entry) => entry.label.trim().length > 0)
      .map((entry) => ({
        label: entry.label.trim(),
        startAt: entry.startAt,
        endAt: entry.endAt,
      }));
    tile.core.nextAction =
      memoInput.trim() ||
      (isLabelOnly
        ? locale === "ja"
          ? "この期間にラベルを適用"
          : "Apply this label within the selected period"
        : locale === "ja"
          ? "開始して最初の1手を実行"
          : "Start and execute the first step");

    tile.interruption.interruptPenalty = interruptPenalty;
    tile.interruption.resumePenalty = resumePenalty;
    tile.interruption.externalInterruptOnly = externalInterruptOnly;

    tile.automation.promptOnStart = promptOnStart;
    tile.automation.promptOnEnd = promptOnEnd;
    tile.automation.autoStartAllowed = autoStartAllowed;
    tile.automation.autoEndAllowed = autoEndAllowed;

    tile.temporal.tz = timezone.trim() ? timezone.trim() : null;

    if (!isRecurring && startDate) {
      tile.temporal.fixedStart = startDate;
      tile.temporal.activeStart = startDate;
    }
    if (!isRecurring && endDate) {
      tile.temporal.fixedEnd = endDate;
      tile.temporal.activeEnd = endDate;
    }
    if (isRecurring && recurrenceValidFromEnabled) {
      const validFrom = parseDateTimeParts(recurrenceValidFromDateInput, "00:00");
      if (validFrom) tile.temporal.releaseAt = validFrom;
    }
    if (isRecurring && recurrenceValidToEnabled) {
      const validTo = parseDateTimeParts(recurrenceValidToDateInput, "23:59");
      if (validTo) tile.temporal.dueAt = validTo;
    }

    setSubmitting(true);
    try {
      const e2eBypassAuth = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1";
      const userId = e2eBypassAuth ? "e2e-user" : (await getSessionClient())?.sub;
      if (!userId) throw new Error(t("quickCreate.authRequired"));

      await execute(
        {
          type: "create_tile",
          tile_id: tileId,
          tile,
        },
        Actor.human(userId),
      );

      setTitle("");
      setTitleEdited(false);
      setIsLabelOnly(false);
      setUseStartAt(false);
      setUseEndAt(false);
      setStartDateInput(getCurrentLocalDate());
      setStartTimeInput(getCurrentLocalTime());
      setEndDateInput(getCurrentLocalDate());
      setEndTimeInput(getLocalTimeAfterMinutes(60));
      setObjectiveMode("finish_once");
      setRecurrenceFrequency("daily");
      setRecurrenceIntervalInput("1");
      setRecurrenceWeekdays([new Date().getDay()]);
      setRecurrenceMonthlyWeekInput("1");
      setRecurrenceMonthlyWeekdayInput(String(new Date().getDay()));
      setRecurrenceUseStartAt(true);
      setRecurrenceUseEndAt(true);
      setRecurrenceStartTimeInput(getCurrentLocalTime());
      setRecurrenceEndTimeInput(getLocalTimeAfterMinutes(60));
      setRecurrenceValidFromEnabled(false);
      setRecurrenceValidToEnabled(false);
      setRecurrenceValidFromDateInput(getCurrentLocalDate());
      setRecurrenceValidToDateInput(getCurrentLocalDate());
      setWorkHoursInput("0");
      setWorkMinutesInput("25");
      setDurationManuallyEdited(false);
      setSelectedProject(null);
      setProjectDraft("");
      setSelectedTags([]);
      setTagDraft("");
      setMemoInput("");
      setDoneRule("manual");
      setInterruptPenalty(3);
      setResumePenalty(3);
      setExternalInterruptOnly(false);
      setPromptOnStart(false);
      setPromptOnEnd(true);
      setAutoStartAllowed(false);
      setAutoEndAllowed(false);
      setTimezone("");
      setTimedLabelDraft("");
      setTimedLabels([]);
      setError(null);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quickCreate.createError"));
    } finally {
      setSubmitting(false);
    }
  }

  const basePanelClass = isDesktop
    ? cn(
        "fixed inset-y-0 right-0 z-[56]",
        "w-[32rem] flex flex-col bg-surface-0 shadow-lg border-l border-border transition-all duration-300 ease-out",
        activePanel !== "base" ? "-translate-x-6 brightness-[0.7]" : "translate-x-0",
        "[animation:slideInFromRight_0.22s_ease-out]",
      )
    : cn(
        "fixed inset-x-0 bottom-0 z-[56]",
        "h-[80vh] flex flex-col rounded-t-2xl bg-surface-0 shadow-lg transition-all duration-300 ease-out",
        activePanel !== "base" ? "translate-y-6 brightness-[0.7]" : "translate-y-0",
        "[animation:slideInFromBottom_0.22s_ease-out]",
      );

  const subPanelClass = (panelName: string) =>
    isDesktop
      ? cn(
          "fixed inset-y-0 right-0 z-[57]",
          "w-[28rem] flex flex-col bg-surface-0 shadow-2xl border-l border-border transition-transform duration-300 ease-out",
          activePanel === panelName ? "translate-x-0" : "translate-x-full pointer-events-none",
        )
      : cn(
          "fixed inset-x-0 bottom-0 z-[57]",
          "h-[75vh] flex flex-col rounded-t-2xl bg-surface-0 shadow-2xl transition-transform duration-300 ease-out",
          activePanel === panelName ? "translate-y-0" : "translate-y-full pointer-events-none",
        );

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-foreground/10 backdrop-blur-[1px]"
        onClick={close}
        aria-hidden
      />
      <section className={basePanelClass}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-base font-semibold text-foreground">{t("quickCreate.title")}</h2>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
            aria-label={locale === "ja" ? "パネルを閉じる" : "Close panel"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <Input
              id="quick-tile-title"
              leading={<Type className="h-4 w-4" />}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleEdited(true);
              }}
              placeholder={t("quickCreate.titlePlaceholder")}
              aria-required="true"
              aria-label={t("quickCreate.titlePlaceholder")}
              size="large"
            />

            {!isLabelOnly ? (
              <div className="flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5">
                <Timer className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
                <DurationInput
                  hours={workHoursInput}
                  minutes={workMinutesInput}
                  onHoursChange={(value) => {
                    setDurationManuallyEdited(true);
                    setWorkHoursInput(value);
                  }}
                  onMinutesChange={(value) => {
                    setDurationManuallyEdited(true);
                    setWorkMinutesInput(value);
                  }}
                  hoursUnit={t("quickCreate.hoursUnit")}
                  minutesUnit={t("quickCreate.minutesUnit")}
                />
              </div>
            ) : null}

            {!isLabelOnly ? (
              <div className="grid grid-cols-3 gap-1 rounded-full border border-border bg-surface-1 p-1">
                <ChoiceButton active={doneRule === "manual"} onClick={() => setDoneRule("manual")}>
                  <CircleDot className="mr-1 inline-block h-4 w-4" aria-hidden="true" />
                  {t("quickCreate.doneRuleManual")}
                </ChoiceButton>
                <ChoiceButton
                  active={doneRule === "time_reached"}
                  onClick={() => setDoneRule("time_reached")}
                >
                  <Clock4 className="mr-1 inline-block h-4 w-4" aria-hidden="true" />
                  {t("quickCreate.doneRuleTimeReached")}
                </ChoiceButton>
                <ChoiceButton
                  active={doneRule === "interval_end"}
                  onClick={() => setDoneRule("interval_end")}
                >
                  <StopCircle className="mr-1 inline-block h-4 w-4" aria-hidden="true" />
                  {t("quickCreate.doneRuleIntervalEnd")}
                </ChoiceButton>
              </div>
            ) : null}

            {/* Schedule (inlined — was a sub-panel before) */}
            <SectionBlock
              title={t("quickCreate.scheduleTitle")}
              helpText={t("quickCreate.scheduleGuide")}
              choiceGrid={false}
            >
              {!isRecurring ? (
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton
                    active={useStartAt}
                    onClick={() => {
                      const next = !useStartAt;
                      setUseStartAt(next);
                      if (!next) {
                        setStartDateInput("");
                        setStartTimeInput("");
                      } else {
                        setStartDateInput((prev) => prev || getCurrentLocalDate());
                        setStartTimeInput((prev) => prev || getCurrentLocalTime());
                      }
                    }}
                  >
                    {t("quickCreate.startAt")}
                  </ChoiceButton>
                  <ChoiceButton
                    active={useEndAt}
                    onClick={() => {
                      const next = !useEndAt;
                      setUseEndAt(next);
                      if (!next) {
                        setEndDateInput("");
                        setEndTimeInput("");
                      } else {
                        setEndDateInput((prev) => prev || startDateInput || getCurrentLocalDate());
                        setEndTimeInput((prev) => prev || getLocalTimeAfterMinutes(60));
                      }
                    }}
                  >
                    {t("quickCreate.endAt")}
                  </ChoiceButton>
                </div>
              ) : null}

              {!isRecurring && useStartAt ? (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      aria-label={`${t("quickCreate.startAt")} (${locale === "ja" ? "日付" : "date"})`}
                      value={startDateInput}
                      onChange={(e) => setStartDateInput(e.target.value)}
                      className="themed-datetime-input w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <input
                      type="time"
                      aria-label={`${t("quickCreate.startAt")} (${locale === "ja" ? "時刻" : "time"})`}
                      step={60}
                      value={startTimeInput}
                      onChange={(e) => setStartTimeInput(e.target.value)}
                      className="themed-datetime-input w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              ) : null}

              {!isRecurring && useEndAt ? (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      aria-label={`${t("quickCreate.endAt")} (${locale === "ja" ? "日付" : "date"})`}
                      value={endDateInput}
                      onChange={(e) => setEndDateInput(e.target.value)}
                      className="themed-datetime-input w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <input
                      type="time"
                      aria-label={`${t("quickCreate.endAt")} (${locale === "ja" ? "時刻" : "time"})`}
                      step={60}
                      value={endTimeInput}
                      onChange={(e) => setEndTimeInput(e.target.value)}
                      className="themed-datetime-input w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              ) : null}
            </SectionBlock>

            {/* Period label (inlined) */}
            <SectionBlock
              title={t("quickCreate.labelOnlyTitle")}
              helpText={t("quickCreate.labelOnlyGuide")}
              choiceGrid={false}
            >
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={isLabelOnly}
                  onChange={(e) => setIsLabelOnly(e.target.checked)}
                  aria-describedby="quick-tile-label-only-help"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>{t("quickCreate.labelOnly")}</span>
              </label>
              <p id="quick-tile-label-only-help" className="text-xs text-foreground-muted">
                {t("quickCreate.labelOnlyHelp")}
              </p>
            </SectionBlock>

            {/* Project / Tags (inlined — was in meta sub-panel) */}
            <SectionBlock
              title={t("quickCreate.metaTitle")}
              helpText={t("quickCreate.metaGuide")}
              choiceGrid={false}
            >
              <div className="relative">
                <input
                  type="text"
                  value={projectDraft}
                  onChange={(e) => {
                    setProjectDraft(e.target.value);
                    setSelectedProject(null);
                  }}
                  onFocus={() => setIsProjectInputFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setIsProjectInputFocused(false), 100);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const normalized = normalizeTag(projectDraft);
                    if (!normalized) return;
                    const matched = existingProjects.find((project) =>
                      equalsIgnoreCase(project, normalized),
                    );
                    const next = matched ?? normalized;
                    setSelectedProject(next);
                    setProjectDraft(next);
                    setIsProjectInputFocused(false);
                  }}
                  aria-label={t("quickCreate.projectPlaceholder")}
                  placeholder={t("quickCreate.projectPlaceholder")}
                  className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                {isProjectInputFocused ? (
                  <div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg bg-surface-elevated p-1 shadow-md border border-border">
                    {projectSuggestions.length > 0 ? (
                      projectSuggestions.map((project) => (
                        <button
                          key={project}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedProject(project);
                            setProjectDraft(project);
                            setIsProjectInputFocused(false);
                          }}
                          className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-surface-1 transition-colors"
                        >
                          {project}
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-foreground-muted">
                        {t("quickCreate.createNew")}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onFocus={() => setIsTagInputFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setIsTagInputFocused(false), 100);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const normalized = normalizeTag(tagDraft);
                    if (!normalized) return;
                    const matched = existingTags.find((tag) => equalsIgnoreCase(tag, normalized));
                    const next = matched ?? normalized;
                    setSelectedTags((prev) =>
                      prev.some((tag) => equalsIgnoreCase(tag, next)) ? prev : [...prev, next],
                    );
                    setTagDraft("");
                  }}
                  aria-label={t("quickCreate.tagsPlaceholder")}
                  placeholder={t("quickCreate.tagsPlaceholder")}
                  className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                {isTagInputFocused ? (
                  <div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg bg-surface-elevated p-1 shadow-md border border-border">
                    {tagSuggestions.length > 0 ? (
                      tagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedTags((prev) =>
                              prev.some((item) => equalsIgnoreCase(item, tag))
                                ? prev
                                : [...prev, tag],
                            );
                            setTagDraft("");
                            setIsTagInputFocused(false);
                          }}
                          className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-surface-1 transition-colors"
                        >
                          {tag}
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-foreground-muted">
                        {t("quickCreate.createNew")}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {selectedTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTags((prev) => prev.filter((item) => item !== tag))}
                      className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                      aria-label={`${t("quickCreate.removeTag")} ${tag}`}
                    >
                      #{tag} &times;
                    </button>
                  ))}
                </div>
              ) : null}
            </SectionBlock>

            {/* Memo (inlined — was in meta sub-panel) */}
            <SectionBlock
              title={t("quickCreate.memoTitle")}
              helpText={t("quickCreate.memoGuide")}
              choiceGrid={false}
            >
              <textarea
                value={memoInput}
                onChange={(e) => setMemoInput(e.target.value)}
                placeholder={t("quickCreate.memoPlaceholder")}
                aria-label={t("quickCreate.memoPlaceholder")}
                rows={3}
                className="w-full resize-none rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </SectionBlock>

            {/* Sub-panel navigation buttons */}
            <div className="pt-4 space-y-2">
              <button
                type="button"
                onClick={() => setActivePanel("recurrence")}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-0 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
              >
                <div className="flex flex-col items-start">
                  <span>{t("quickCreate.recurrenceNavTitle")}</span>
                  <span className="text-xs text-foreground-muted font-normal">
                    {t("quickCreate.recurrenceNavGuide")}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-foreground-subtle" />
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("interrupt")}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-0 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
              >
                <div className="flex flex-col items-start">
                  <span>{t("quickCreate.interruptNavTitle")}</span>
                  <span className="text-xs text-foreground-muted font-normal">
                    {t("quickCreate.interruptNavGuide")}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-foreground-subtle" />
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("automation")}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-0 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
              >
                <div className="flex flex-col items-start">
                  <span>{t("quickCreate.automationNavTitle")}</span>
                  <span className="text-xs text-foreground-muted font-normal">
                    {t("quickCreate.automationNavGuide")}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-foreground-subtle" />
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("meta")}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-0 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
              >
                <div className="flex flex-col items-start">
                  <span>{t("quickCreate.metaNavTitle")}</span>
                  <span className="text-xs text-foreground-muted font-normal">
                    {t("quickCreate.metaNavGuide")}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-foreground-subtle" />
              </button>
            </div>
          </div>
        </div>
        {/* Footer Actions */}
        <div className="border-t border-border bg-surface-0 p-4 shrink-0">
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting}
            className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-opacity disabled:opacity-50"
          >
            {submitting ? t("quickCreate.saving") : t("quickCreate.commit")}
          </button>
          {error ? (
            <p role="alert" className="mt-2 text-center text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      {/* Sub Panel: Recurrence */}
      <section className={subPanelClass("recurrence")}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={() => setActivePanel("base")}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("quickCreate.back")}
          </button>
          <h2 className="text-sm font-semibold text-foreground">
            {t("quickCreate.recurrenceNavTitle")}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <SectionBlock>
              <ChoiceButton
                active={objectiveMode === "finish_once"}
                onClick={() => setObjectiveMode("finish_once")}
              >
                {t("quickCreate.objectiveFinish")}
              </ChoiceButton>
              <ChoiceButton
                active={objectiveMode === "recurring"}
                onClick={() => setObjectiveMode("recurring")}
              >
                {t("quickCreate.objectiveRecurring")}
              </ChoiceButton>
              {showFocusUntilEnd ? (
                <ChoiceButton
                  active={objectiveMode === "maximize_within_interval"}
                  onClick={() =>
                    setObjectiveMode((prev) =>
                      prev === "maximize_within_interval"
                        ? "finish_once"
                        : "maximize_within_interval",
                    )
                  }
                >
                  {t("quickCreate.objectiveMaximize")}
                </ChoiceButton>
              ) : null}
            </SectionBlock>

            {isRecurring ? (
              <SectionBlock
                title={t("quickCreate.recurrenceTitle")}
                helpText={t("quickCreate.recurrenceGuide")}
                choiceGrid={false}
              >
                <div className="grid grid-cols-3 gap-2">
                  <ChoiceButton
                    active={recurrenceFrequency === "daily"}
                    onClick={() => setRecurrenceFrequency("daily")}
                  >
                    {t("quickCreate.recurrenceFreqDaily")}
                  </ChoiceButton>
                  <ChoiceButton
                    active={recurrenceFrequency === "weekly"}
                    onClick={() => setRecurrenceFrequency("weekly")}
                  >
                    {t("quickCreate.recurrenceFreqWeekly")}
                  </ChoiceButton>
                  <ChoiceButton
                    active={recurrenceFrequency === "monthly"}
                    onClick={() => setRecurrenceFrequency("monthly")}
                  >
                    {t("quickCreate.recurrenceFreqMonthly")}
                  </ChoiceButton>
                </div>
                <label className="space-y-1">
                  <span className="text-xs text-foreground-muted">
                    {t("quickCreate.recurrenceInterval")}
                  </span>
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                    <span className="text-sm text-foreground-muted">
                      {locale === "ja" ? "毎" : "Every"}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={recurrenceIntervalInput}
                      onChange={(e) =>
                        setRecurrenceIntervalInput(sanitizeNumericInput(e.target.value))
                      }
                      onBlur={() => {
                        const n = parseNonNegativeInt(recurrenceIntervalInput) ?? 0;
                        if (n <= 0) setRecurrenceIntervalInput("1");
                      }}
                      className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="text-sm text-foreground-muted">
                      {getRecurrenceIntervalSuffix(
                        locale,
                        recurrenceFrequency,
                        parseNonNegativeInt(recurrenceIntervalInput) || 1,
                      )}
                    </span>
                  </div>
                </label>
                {recurrenceFrequency === "weekly" ? (
                  <div className="grid grid-cols-4 gap-2">
                    {getWeekdayOptions(locale).map((day) => (
                      <ChoiceButton
                        key={day.value}
                        active={recurrenceWeekdays.includes(day.value)}
                        onClick={() =>
                          setRecurrenceWeekdays((prev) =>
                            prev.includes(day.value)
                              ? prev.filter((d) => d !== day.value)
                              : [...prev, day.value].sort((a, b) => a - b),
                          )
                        }
                      >
                        {day.label}
                      </ChoiceButton>
                    ))}
                  </div>
                ) : null}
                {recurrenceFrequency === "monthly" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-xs text-foreground-muted">
                        {t("quickCreate.recurrenceMonthlyWeek")}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={recurrenceMonthlyWeekInput}
                        onChange={(e) =>
                          setRecurrenceMonthlyWeekInput(sanitizeNumericInput(e.target.value))
                        }
                        className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-foreground-muted">
                        {t("quickCreate.recurrenceMonthlyWeekday")}
                      </span>
                      <select
                        value={recurrenceMonthlyWeekdayInput}
                        onChange={(e) => setRecurrenceMonthlyWeekdayInput(e.target.value)}
                        className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        {getWeekdayOptions(locale).map((day) => (
                          <option key={day.value} value={day.value}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </SectionBlock>
            ) : null}

            {isRecurring ? (
              <>
                <SectionBlock
                  title={t("quickCreate.scheduleTitle")}
                  helpText={t("quickCreate.scheduleGuide")}
                  choiceGrid={false}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <ChoiceButton
                      active={recurrenceUseStartAt}
                      onClick={() => {
                        const next = !recurrenceUseStartAt;
                        setRecurrenceUseStartAt(next);
                        if (!next) {
                          setRecurrenceStartTimeInput("");
                        } else {
                          setRecurrenceStartTimeInput((prev) => prev || getCurrentLocalTime());
                        }
                      }}
                    >
                      {t("quickCreate.windowStartAt")}
                    </ChoiceButton>
                    <ChoiceButton
                      active={recurrenceUseEndAt}
                      onClick={() => {
                        const next = !recurrenceUseEndAt;
                        setRecurrenceUseEndAt(next);
                        if (!next) {
                          setRecurrenceEndTimeInput("");
                        } else {
                          setRecurrenceEndTimeInput((prev) => prev || getLocalTimeAfterMinutes(60));
                        }
                      }}
                    >
                      {t("quickCreate.windowEndAt")}
                    </ChoiceButton>
                  </div>

                  {recurrenceUseStartAt || recurrenceUseEndAt ? (
                    <div className="grid grid-cols-2 gap-2">
                      {recurrenceUseStartAt ? (
                        <input
                          type="time"
                          aria-label={t("quickCreate.windowStartAt")}
                          step={60}
                          value={recurrenceStartTimeInput}
                          onChange={(e) => setRecurrenceStartTimeInput(e.target.value)}
                          className="themed-datetime-input w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      ) : (
                        <div />
                      )}
                      {recurrenceUseEndAt ? (
                        <input
                          type="time"
                          aria-label={t("quickCreate.windowEndAt")}
                          step={60}
                          value={recurrenceEndTimeInput}
                          onChange={(e) => setRecurrenceEndTimeInput(e.target.value)}
                          className="themed-datetime-input w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      ) : (
                        <div />
                      )}
                    </div>
                  ) : null}
                </SectionBlock>

                <SectionBlock title={t("quickCreate.recurrenceValidityTitle")} choiceGrid={false}>
                  <div className="grid grid-cols-2 gap-2">
                    <ChoiceButton
                      active={recurrenceValidFromEnabled}
                      onClick={() => setRecurrenceValidFromEnabled((prev) => !prev)}
                    >
                      {t("quickCreate.recurrenceValidFrom")}
                    </ChoiceButton>
                    <ChoiceButton
                      active={recurrenceValidToEnabled}
                      onClick={() => setRecurrenceValidToEnabled((prev) => !prev)}
                    >
                      {t("quickCreate.recurrenceValidTo")}
                    </ChoiceButton>
                  </div>
                  {recurrenceValidFromEnabled || recurrenceValidToEnabled ? (
                    <div className="grid grid-cols-2 gap-2">
                      {recurrenceValidFromEnabled ? (
                        <input
                          type="date"
                          aria-label={t("quickCreate.recurrenceValidFrom")}
                          value={recurrenceValidFromDateInput}
                          onChange={(e) => setRecurrenceValidFromDateInput(e.target.value)}
                          className="themed-datetime-input w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      ) : (
                        <div />
                      )}
                      {recurrenceValidToEnabled ? (
                        <input
                          type="date"
                          aria-label={t("quickCreate.recurrenceValidTo")}
                          value={recurrenceValidToDateInput}
                          onChange={(e) => setRecurrenceValidToDateInput(e.target.value)}
                          className="themed-datetime-input w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      ) : (
                        <div />
                      )}
                    </div>
                  ) : null}
                </SectionBlock>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* Sub Panel: Interrupt rules */}
      <section className={subPanelClass("interrupt")}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={() => setActivePanel("base")}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("quickCreate.back")}
          </button>
          <h2 className="text-sm font-semibold text-foreground">
            {t("quickCreate.interruptNavTitle")}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <SectionBlock
              title={t("quickCreate.interruptPenaltyTitle")}
              helpText={t("quickCreate.interruptPenaltyGuide")}
              choiceGrid={false}
            >
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <ChoiceButton
                    key={`interrupt-${level}`}
                    active={interruptPenalty === level}
                    onClick={() => setInterruptPenalty(level)}
                  >
                    {String(level)}
                  </ChoiceButton>
                ))}
              </div>
            </SectionBlock>

            <SectionBlock
              title={t("quickCreate.resumePenaltyTitle")}
              helpText={t("quickCreate.resumePenaltyGuide")}
              choiceGrid={false}
            >
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <ChoiceButton
                    key={`resume-${level}`}
                    active={resumePenalty === level}
                    onClick={() => setResumePenalty(level)}
                  >
                    {String(level)}
                  </ChoiceButton>
                ))}
              </div>
            </SectionBlock>

            <SectionBlock
              title={t("quickCreate.externalInterruptOnlyTitle")}
              helpText={t("quickCreate.externalInterruptOnlyGuide")}
              choiceGrid={false}
            >
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={externalInterruptOnly}
                  onChange={(e) => setExternalInterruptOnly(e.target.checked)}
                  aria-label={t("quickCreate.externalInterruptOnlyTitle")}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>{t("quickCreate.externalInterruptOnlyTitle")}</span>
              </label>
            </SectionBlock>
          </div>
        </div>
      </section>

      {/* Sub Panel: Automation */}
      <section className={subPanelClass("automation")}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={() => setActivePanel("base")}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("quickCreate.back")}
          </button>
          <h2 className="text-sm font-semibold text-foreground">
            {t("quickCreate.automationNavTitle")}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <SectionBlock choiceGrid={false}>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={promptOnStart}
                  onChange={(e) => setPromptOnStart(e.target.checked)}
                  aria-label={t("quickCreate.promptOnStartTitle")}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>{t("quickCreate.promptOnStartTitle")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={promptOnEnd}
                  onChange={(e) => setPromptOnEnd(e.target.checked)}
                  aria-label={t("quickCreate.promptOnEndTitle")}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>{t("quickCreate.promptOnEndTitle")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={autoStartAllowed}
                  onChange={(e) => setAutoStartAllowed(e.target.checked)}
                  aria-label={t("quickCreate.autoStartAllowedTitle")}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>{t("quickCreate.autoStartAllowedTitle")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={autoEndAllowed}
                  onChange={(e) => setAutoEndAllowed(e.target.checked)}
                  aria-label={t("quickCreate.autoEndAllowedTitle")}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>{t("quickCreate.autoEndAllowedTitle")}</span>
              </label>
            </SectionBlock>

            <SectionBlock
              title={t("quickCreate.timezoneTitle")}
              helpText={t("quickCreate.timezoneGuide")}
              choiceGrid={false}
            >
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                aria-label={t("quickCreate.timezoneTitle")}
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">{t("quickCreate.timezoneAuto")}</option>
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </SectionBlock>
          </div>
        </div>
      </section>

      {/* Sub Panel: Meta */}
      <section className={subPanelClass("meta")}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={() => setActivePanel("base")}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("quickCreate.back")}
          </button>
          <h2 className="text-sm font-semibold text-foreground">{t("quickCreate.metaNavTitle")}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <SectionBlock
              title={t("quickCreate.timedLabelsTitle")}
              helpText={t("quickCreate.timedLabelsGuide")}
              choiceGrid={false}
            >
              {timedLabels.length > 0 ? (
                <div className="space-y-2">
                  {timedLabels.map((entry, index) => (
                    <div
                      key={`${entry.label}-${index}`}
                      className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm text-foreground"
                    >
                      <span className="truncate">{entry.label}</span>
                      <button
                        type="button"
                        onClick={() => setTimedLabels((prev) => prev.filter((_, i) => i !== index))}
                        className="ml-2 text-xs text-foreground-muted hover:text-foreground transition-colors"
                        aria-label={`${t("quickCreate.removeTag")} ${entry.label}`}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  value={timedLabelDraft}
                  onChange={(e) => setTimedLabelDraft(e.target.value)}
                  placeholder={t("quickCreate.timedLabelsLabel")}
                  aria-label={t("quickCreate.timedLabelsLabel")}
                  className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = timedLabelDraft.trim();
                    if (!trimmed) return;
                    setTimedLabels((prev) => [
                      ...prev,
                      { label: trimmed, startAt: null, endAt: null },
                    ]);
                    setTimedLabelDraft("");
                  }}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-fg hover:opacity-90 transition-opacity"
                >
                  {t("quickCreate.timedLabelsAdd")}
                </button>
              </div>
            </SectionBlock>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionBlock({
  title,
  helpText,
  choiceGrid = true,
  children,
}: {
  title?: string;
  helpText?: string;
  choiceGrid?: boolean;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <div className="space-y-2" aria-labelledby={title ? headingId : undefined}>
      {title ? (
        <div className="flex items-center gap-2">
          <h3 id={headingId} className="text-sm font-medium text-foreground">
            {title}
          </h3>
          {helpText ? <HelpBadge text={helpText} /> : null}
        </div>
      ) : null}
      <div className={choiceGrid ? "grid grid-cols-2 gap-2" : "space-y-2"}>{children}</div>
    </div>
  );
}

function HelpBadge({ text }: { text: string }) {
  return (
    <span className="group/tooltip relative inline-flex">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-foreground-muted"
        role="img"
        aria-label={text}
        title={text}
      >
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-48 -translate-x-1/2 rounded-md bg-surface-2 px-2 py-1 text-[10px] font-normal leading-snug text-foreground group-hover/tooltip:block group-focus-within/tooltip:block">
        {text}
      </span>
    </span>
  );
}

function ChoiceButton({
  active,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground hover:bg-surface-1",
      ].join(" ")}
    >
      <span>{children}</span>
    </button>
  );
}

function DurationInput({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  hoursUnit,
  minutesUnit,
}: {
  hours: string;
  minutes: string;
  onHoursChange: (next: string) => void;
  onMinutesChange: (next: string) => void;
  hoursUnit: string;
  minutesUnit: string;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const parsedHours = Math.max(0, Math.min(99, parseNonNegativeInt(hours) ?? 0));
  const parsedMinutes = Math.max(0, Math.min(59, parseNonNegativeInt(minutes) ?? 0));
  const [activeSegment, setActiveSegment] = useState<"hours" | "minutes">("hours");
  const [typedCount, setTypedCount] = useState(0);
  const durationInputRef = useRef<HTMLInputElement | null>(null);
  const displayValue = formatHHMM(parsedHours, parsedMinutes);

  function applyDuration(nextHours: number, nextMinutes: number) {
    const normalizedHours = Math.max(0, Math.min(99, nextHours));
    const normalizedMinutes = Math.max(0, Math.min(59, nextMinutes));
    onHoursChange(String(normalizedHours));
    onMinutesChange(String(normalizedMinutes));
  }

  function adjust(deltaMinutes: number) {
    const total = parsedHours * 60 + parsedMinutes + deltaMinutes;
    const clamped = Math.max(0, Math.min(99 * 60 + 59, total));
    applyDuration(Math.floor(clamped / 60), clamped % 60);
  }

  function applyPreset(totalMinutes: number) {
    const clamped = Math.max(0, Math.min(99 * 60 + 59, totalMinutes));
    applyDuration(Math.floor(clamped / 60), clamped % 60);
  }

  function focusSegment(nextSegment: "hours" | "minutes", resetTyped = true) {
    setActiveSegment(nextSegment);
    if (resetTyped) setTypedCount(0);
    window.requestAnimationFrame(() => {
      const input = durationInputRef.current;
      if (!input) return;
      if (nextSegment === "hours") input.setSelectionRange(0, 2);
      else input.setSelectionRange(3, 5);
    });
  }

  function applyDigitInput(digit: string) {
    const source =
      activeSegment === "hours"
        ? parsedHours.toString().padStart(2, "0")
        : parsedMinutes.toString().padStart(2, "0");
    const nextText = `${source}${digit}`.slice(-2);
    const nextValue = Number.parseInt(nextText, 10);
    if (activeSegment === "hours") applyDuration(nextValue, parsedMinutes);
    else applyDuration(parsedHours, nextValue);

    const nextTypedCount = Math.min(2, typedCount + 1);
    if (activeSegment === "hours" && nextTypedCount >= 2) {
      focusSegment("minutes");
      return;
    }
    setTypedCount(nextTypedCount);
    focusSegment(activeSegment, false);
  }

  return (
    <div className="relative space-y-2">
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <input
          ref={durationInputRef}
          type="text"
          inputMode="numeric"
          value={displayValue}
          readOnly
          onFocus={(e) => {
            const cursor = e.currentTarget.selectionStart ?? 0;
            focusSegment(cursor >= 3 ? "minutes" : "hours");
          }}
          onClick={(e) => {
            const cursor = e.currentTarget.selectionStart ?? 0;
            focusSegment(cursor >= 3 ? "minutes" : "hours");
          }}
          onBlur={() => setTypedCount(0)}
          onKeyDown={(e) => {
            if (/^\d$/.test(e.key)) {
              e.preventDefault();
              applyDigitInput(e.key);
              return;
            }
            if (e.key === ":") {
              e.preventDefault();
              focusSegment("minutes");
              return;
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              focusSegment("hours");
              return;
            }
            if (e.key === "ArrowRight") {
              e.preventDefault();
              focusSegment("minutes");
              return;
            }
            if (e.key === "Backspace" || e.key === "Delete") {
              e.preventDefault();
              if (activeSegment === "hours") {
                applyDuration(0, parsedMinutes);
                focusSegment("hours");
              } else {
                applyDuration(parsedHours, 0);
                if (e.key === "Backspace") focusSegment("hours");
                else focusSegment("minutes");
              }
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              setTypedCount(0);
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!text) return;
            const parsed = parseHHMM(text);
            if (!parsed) return;
            e.preventDefault();
            applyDuration(parsed.hours, parsed.minutes);
            focusSegment("minutes");
          }}
          className="w-full rounded-lg bg-surface-1 px-3 py-2 text-center text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
          aria-label={`${hoursUnit}:${minutesUnit}`}
        />
        <button
          type="button"
          onClick={() => setIsPickerOpen((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-1 text-foreground transition-colors hover:bg-surface-2"
          aria-label="Open time picker panel"
        >
          <Clock3 className="h-4 w-4" />
        </button>
      </div>

      {isPickerOpen ? (
        <div className="absolute right-0 top-12 z-30 w-64 rounded-xl bg-surface-elevated p-3">
          <div className="mb-3 text-center text-lg font-semibold tabular-nums text-foreground">
            {formatHHMM(parsedHours, parsedMinutes)}
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="space-y-1">
              <PickerButton onClick={() => applyDuration(parsedHours + 1, parsedMinutes)}>
                +
              </PickerButton>
              <div className="rounded-md bg-surface-1 py-1 text-center text-sm font-medium tabular-nums">
                {parsedHours.toString().padStart(2, "0")}
              </div>
              <PickerButton onClick={() => applyDuration(parsedHours - 1, parsedMinutes)}>
                -
              </PickerButton>
            </div>
            <div className="text-center text-base font-semibold text-foreground-muted">:</div>
            <div className="space-y-1">
              <PickerButton onClick={() => adjust(5)}>+</PickerButton>
              <div className="rounded-md bg-surface-1 py-1 text-center text-sm font-medium tabular-nums">
                {parsedMinutes.toString().padStart(2, "0")}
              </div>
              <PickerButton onClick={() => adjust(-5)}>-</PickerButton>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <PresetButton onClick={() => applyPreset(15)}>15m</PresetButton>
            <PresetButton onClick={() => applyPreset(25)}>25m</PresetButton>
            <PresetButton onClick={() => applyPreset(45)}>45m</PresetButton>
            <PresetButton onClick={() => applyPreset(60)}>1h</PresetButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseDurationToMinutes(hoursValue: string, minutesValue: string): number | null {
  const hours = parseNonNegativeInt(hoursValue);
  const minutes = parseNonNegativeInt(minutesValue);
  if (hours === null && minutes === null) return null;
  const total = (hours ?? 0) * 60 + (minutes ?? 0);
  if (total <= 0) return null;
  return total;
}

function parseBoundedDurationMinutes(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): number | null {
  const start = parseDateTimeParts(startDate, startTime);
  const end = parseDateTimeParts(endDate, endTime);
  if (!start || !end) return null;
  const diff = Math.floor((end.getTime() - start.getTime()) / 60000);
  if (diff <= 0) return null;
  return diff;
}

function parseDateTimeParts(datePart: string, timePart: string): Date | null {
  if (!datePart || !timePart) return null;
  const date = new Date(`${datePart}T${timePart}`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseNonNegativeInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function sanitizeNumericInput(value: string): string {
  return value.replace(/\D/g, "");
}

function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function getWeekdayOptions(locale: "ja" | "en"): Array<{ value: number; label: string }> {
  return locale === "ja"
    ? [
        { value: 0, label: "日" },
        { value: 1, label: "月" },
        { value: 2, label: "火" },
        { value: 3, label: "水" },
        { value: 4, label: "木" },
        { value: 5, label: "金" },
        { value: 6, label: "土" },
      ]
    : [
        { value: 0, label: "Sun" },
        { value: 1, label: "Mon" },
        { value: 2, label: "Tue" },
        { value: 3, label: "Wed" },
        { value: 4, label: "Thu" },
        { value: 5, label: "Fri" },
        { value: 6, label: "Sat" },
      ];
}

// JS Date#getDay returns 0=Sun..6=Sat. The v7 weekday_mask uses
// bit 0=Mon..bit 6=Sun, so we remap: bit = (jsDay + 6) % 7.
function weekdaysToBitmask(jsDays: number[]): number {
  let mask = 0;
  for (const d of jsDays) {
    const bit = (d + 6) % 7;
    mask |= 1 << bit;
  }
  return mask;
}

function getRecurrenceIntervalSuffix(
  locale: "ja" | "en",
  frequency: "daily" | "weekly" | "monthly",
  interval: number,
): string {
  if (locale === "ja") {
    if (frequency === "daily") return "日ごと";
    if (frequency === "weekly") return "週ごと";
    return "か月ごと";
  }
  if (frequency === "daily") return interval === 1 ? "day" : "days";
  if (frequency === "weekly") return interval === 1 ? "week" : "weeks";
  return interval === 1 ? "month" : "months";
}

function formatHHMM(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function parseHHMM(raw: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(raw.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 99 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function PickerButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md bg-surface-2 py-1 text-center text-sm text-foreground transition-colors hover:bg-surface-1"
    >
      {children}
    </button>
  );
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-surface-2 px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-surface-1"
    >
      {children}
    </button>
  );
}

function formatDuration(totalMinutes: number, locale: "ja" | "en"): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (locale === "ja") {
    if (hours > 0 && minutes > 0) return `${hours}時間${minutes}分`;
    if (hours > 0) return `${hours}時間`;
    return `${minutes}分`;
  }

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatDateShort(date: Date, locale: "ja" | "en"): string {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function minutesToHourMinuteStrings(totalMinutes: number): {
  hours: string;
  minutes: string;
} {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours: String(hours), minutes: String(minutes) };
}

function buildLabels(projectInput: string, selectedTags: string[]): string[] {
  const labels: string[] = [];
  const project = projectInput.trim();
  if (project) {
    labels.push(`project:${project}`);
  }

  return [...labels, ...selectedTags];
}

function deriveProjectAndTags(state: { tiles: Map<unknown, Tile> }): {
  existingProjects: string[];
  existingTags: string[];
} {
  const projectSet = new Set<string>();
  const tagSet = new Set<string>();

  for (const tile of state.tiles.values()) {
    for (const label of tile.annotation.labels) {
      if (label.startsWith("project:")) {
        const project = label.slice("project:".length).trim();
        if (project) projectSet.add(project);
      } else if (label.trim()) {
        tagSet.add(label.trim());
      }
    }
  }

  return {
    existingProjects: Array.from(projectSet).sort((a, b) => a.localeCompare(b)),
    existingTags: Array.from(tagSet).sort((a, b) => a.localeCompare(b)),
  };
}

function normalizeTag(value: string): string {
  return value.trim();
}

function equalsIgnoreCase(a: string, b: string): boolean {
  return (
    a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0 ||
    a.toLowerCase() === b.toLowerCase()
  );
}

function getCurrentLocalDate(): string {
  return toLocalDateString(new Date());
}

function getCurrentLocalTime(): string {
  return toLocalTimeString(new Date());
}

function getLocalTimeAfterMinutes(minutes: number): string {
  const date = new Date(Date.now() + minutes * 60 * 1000);
  return toLocalTimeString(date);
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Curated list of common IANA timezones for the Automation sub-panel.
// A full searchable IANA list would be too heavy; this covers the
// regions our users span. `""` (Use device timezone) is added at the
// UI layer as the default option.
const COMMON_TIMEZONES: readonly string[] = [
  "UTC",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
];
