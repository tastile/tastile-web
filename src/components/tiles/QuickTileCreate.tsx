"use client";

import {
  Ban,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Clock4,
  FileText,
  FolderOpen,
  MessageSquare,
  Plus,
  Repeat,
  Tag,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import {
  FormDivider,
  FormPanel,
  RowInput,
  RowSegmented,
  RowSubPanel,
  RowToggle,
} from "@/components/ui/form";
import { getSessionClient } from "@/lib/daemon/id-token-client";
import type { DoneRule, ObjectiveMode, Tile } from "@/lib/domain/tile";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";
import {
  type CreateTileCommand,
  type QuickCreateFormState,
  type RecurrenceFrequency,
  Actor,
  buildCreateTileCommand,
  deriveProjectAndTags,
  equalsIgnoreCase,
  formatDateShort,
  formatDuration,
  getCurrentLocalDate,
  getCurrentLocalTime,
  getLocalTimeAfterMinutes,
  minutesToHourMinuteStrings,
  normalizeTag,
  parseBoundedDurationMinutes,
  parseDateTimeParts,
  parseDurationToMinutes,
  parseNonNegativeInt,
  parseTimeToMinutes,
} from "./build-command";
import { QuickTileRecurrenceSubPanel } from "./sub-panels/QuickTileRecurrenceSubPanel";
import { QuickTileInterruptSubPanel } from "./sub-panels/QuickTileInterruptSubPanel";
import { QuickTileAutomationSubPanel } from "./sub-panels/QuickTileAutomationSubPanel";
import { QuickTileMetaSubPanel } from "./sub-panels/QuickTileMetaSubPanel";

const DONE_RULE_OPTIONS: ReadonlyArray<{ value: DoneRule; label: string }> = [
  { value: "manual", label: "quickCreate.doneRuleManual" },
  { value: "time_reached", label: "quickCreate.doneRuleTimeReached" },
  { value: "interval_end", label: "quickCreate.doneRuleIntervalEnd" },
];

type ActivePanel = "base" | "recurrence" | "interrupt" | "automation" | "meta";

export function QuickTileCreate() {
  const { isOpen, close } = useQuickCreateStore();
  const isDesktop = useIsDesktop();
  const { t, locale } = useTranslation();
  const { state, execute } = useExecutionEngineContext();

  const [activePanel, setActivePanel] = useState<ActivePanel>("base");

  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [isLabelOnly, setIsLabelOnly] = useState(false);
  const [useStartAt, setUseStartAt] = useState(false);
  const [useEndAt, setUseEndAt] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [startDateInput, setStartDateInput] = useState(() => getCurrentLocalDate());
  const [startTimeInput, setStartTimeInput] = useState(() => getCurrentLocalTime());
  const [endDateInput, setEndDateInput] = useState(() => getCurrentLocalDate());
  const [endTimeInput, setEndTimeInput] = useState(() => getLocalTimeAfterMinutes(60));
  const [objectiveMode, setObjectiveMode] = useState<ObjectiveMode>("finish_once");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("daily");
  const [recurrenceIntervalInput, setRecurrenceIntervalInput] = useState("1");
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([new Date().getDay()]);
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
  const [projectDraft, setProjectDraft] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isProjectInputFocused, setIsProjectInputFocused] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const [memoInput, setMemoInput] = useState("");
  const [memoExpanded, setMemoExpanded] = useState(false);
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
  const [invalidField, setInvalidField] = useState<"title" | "duration" | null>(null);

  // --- derived values ---------------------------------------------------
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
  const scheduleSummary = (() => {
    if (hasStart && hasEnd) {
      return `${t("quickCreate.scheduleSummaryStartEnd")}${startDateInput} ${startTimeInput} - ${endDateInput} ${endTimeInput}`;
    }
    if (hasStart) {
      return `${t("quickCreate.scheduleSummaryStartOnly")}${startDateInput} ${startTimeInput}`;
    }
    if (hasEnd) {
      return `${t("quickCreate.scheduleSummaryEndOnly")}${endDateInput} ${endTimeInput}`;
    }
    return t("quickCreate.scheduleSummaryAnytime");
  })();
  const isRecurring = objectiveMode === "recurring";
  const showFocusUntilEnd = !isLabelOnly && !isRecurring && hasEnd;
  const recurrenceInterval = parseNonNegativeInt(recurrenceIntervalInput) ?? 0;
  const recurrenceWindowValid =
    !recurrenceUseStartAt ||
    !recurrenceUseEndAt ||
    (recurrenceStartOffsetMin !== null &&
      recurrenceEndOffsetMin !== null &&
      recurrenceEndOffsetMin > recurrenceStartOffsetMin);

  const { existingProjects, existingTags } = deriveProjectAndTags(state as { tiles: Map<unknown, Tile> });
  const normalizedProjectDraft = normalizeTag(projectDraft);
  const resolvedProject =
    selectedProject ??
    (normalizedProjectDraft
      ? (existingProjects.find((project) => equalsIgnoreCase(project, normalizedProjectDraft)) ??
        normalizedProjectDraft)
      : "");
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

  const suggestedTitle = useMemo(() => {
    if (isLabelOnly) {
      return locale === "ja" ? "期間ラベル" : "Period label";
    }
    if (objectiveMode === "recurring") {
      if (workTargetText) {
        return locale === "ja"
          ? `定期タスク ${workTargetText}`
          : `Recurring task ${workTargetText}`;
      }
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
    if (workTargetText) {
      return locale === "ja" ? `作業 ${workTargetText}` : `Task ${workTargetText}`;
    }
    return locale === "ja" ? "作業タスク" : "Task";
  }, [isLabelOnly, objectiveMode, workTargetText, showFocusUntilEnd, startDate, endDate, locale]);

  useEffect(() => {
    if (!titleEdited) setTitle(suggestedTitle);
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

  // WYSIWYG: switching to recurring opens the Recurrence sub-panel.
  useEffect(() => {
    if (objectiveMode === "recurring" && activePanel === "base") {
      setActivePanel("recurrence");
    }
  }, [objectiveMode, activePanel]);

  if (!isOpen) return null;

  // --- submit validity --------------------------------------------------
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

  // --- submit handler ---------------------------------------------------
  async function handleCreate() {
    setError(null);
    setInvalidField(null);
    if (title.trim().length === 0) {
      setError(t("quickCreate.titleRequired"));
      setInvalidField("title");
      return;
    }
    if (!temporalOrderValid) {
      setError(t("quickCreate.invalidTemporalOrder"));
      return;
    }
    if (!isLabelOnly && !isRecurring && hasAnyTemporalConstraint && (workTargetMin ?? 0) <= 0) {
      setError(t("quickCreate.durationRequired"));
      setInvalidField("duration");
      return;
    }
    if (objectiveMode === "recurring" && recurrenceInterval <= 0) {
      setError(t("quickCreate.recurrenceStepRequired"));
      return;
    }
    if (!canSubmit) return;

    const formState: QuickCreateFormState = {
      title,
      isLabelOnly,
      useStartAt,
      useEndAt,
      startDateInput,
      startTimeInput,
      endDateInput,
      endTimeInput,
      objectiveMode,
      recurrenceFrequency,
      recurrenceIntervalInput,
      recurrenceWeekdays,
      recurrenceUseStartAt,
      recurrenceUseEndAt,
      recurrenceStartTimeInput,
      recurrenceEndTimeInput,
      recurrenceValidFromEnabled,
      recurrenceValidToEnabled,
      recurrenceValidFromDateInput,
      recurrenceValidToDateInput,
      workHoursInput,
      workMinutesInput,
      resolvedProject,
      selectedTags,
      memoInput,
      doneRule,
      interruptPenalty,
      resumePenalty,
      externalInterruptOnly,
      promptOnStart,
      promptOnEnd,
      autoStartAllowed,
      autoEndAllowed,
      timezone,
      timedLabels,
    };
    const command: CreateTileCommand = buildCreateTileCommand({
      state: formState,
      effectiveDurationMin,
      locale,
    });

    setSubmitting(true);
    try {
      const e2eBypassAuth = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1";
      const userId = e2eBypassAuth ? "e2e-user" : (await getSessionClient())?.sub;
      if (!userId) throw new Error(t("quickCreate.authRequired"));

      await execute(command, Actor.human(userId));

      // Reset form
      setTitle("");
      setTitleEdited(false);
      setIsLabelOnly(false);
      setUseStartAt(false);
      setUseEndAt(false);
      setScheduleOpen(false);
      setStartDateInput(getCurrentLocalDate());
      setStartTimeInput(getCurrentLocalTime());
      setEndDateInput(getCurrentLocalDate());
      setEndTimeInput(getLocalTimeAfterMinutes(60));
      setObjectiveMode("finish_once");
      setRecurrenceFrequency("daily");
      setRecurrenceIntervalInput("1");
      setRecurrenceWeekdays([new Date().getDay()]);
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
      setMemoExpanded(false);
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
      setActivePanel("base");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quickCreate.createError"));
    } finally {
      setSubmitting(false);
    }
  }

  // --- panel classes ----------------------------------------------------
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

  const subPanelClass = (panelName: ActivePanel) =>
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
      <section
        className={basePanelClass}
        onClick={() => {
          if (activePanel !== "base") setActivePanel("base");
        }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-section">
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
        <div className="flex-1 overflow-y-auto">
          <FormPanel>
            <RowInput
              icon={FileText}
              placeholder={t("quickCreate.titlePlaceholder")}
              value={title}
              onChange={(value) => {
                setTitle(value);
                setTitleEdited(true);
                if (invalidField === "title") setInvalidField(null);
              }}
              ariaLabel={t("quickCreate.titlePlaceholder")}
              ariaDescribedBy={invalidField === "title" ? "quick-create-error" : undefined}
              required
              invalid={invalidField === "title"}
              className="quick-tile-title-row"
            />

            {!isLabelOnly ? (
              <DurationRow
                hours={workHoursInput}
                minutes={workMinutesInput}
                hoursUnit={t("quickCreate.hoursUnit")}
                minutesUnit={t("quickCreate.minutesUnit")}
                ariaLabel={t("quickCreate.durationAriaLabel")}
                onHoursChange={(value) => {
                  setDurationManuallyEdited(true);
                  setWorkHoursInput(value);
                  if (invalidField === "duration") setInvalidField(null);
                }}
                onMinutesChange={(value) => {
                  setDurationManuallyEdited(true);
                  setWorkMinutesInput(value);
                  if (invalidField === "duration") setInvalidField(null);
                }}
              />
            ) : null}

            {!isLabelOnly ? (
              <RowSegmented
                icon={CheckCircle2}
                options={DONE_RULE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.label) }))}
                value={doneRule}
                onChange={setDoneRule}
              />
            ) : null}

            {!isRecurring ? (
              <ScheduleRow
                scheduleOpen={scheduleOpen}
                onToggleSchedule={() => setScheduleOpen((prev) => !prev)}
                scheduleSummary={scheduleSummary}
                scheduleTitle={t("quickCreate.scheduleTitle")}
                startDateInput={startDateInput}
                startTimeInput={startTimeInput}
                endDateInput={endDateInput}
                endTimeInput={endTimeInput}
                onStartDateChange={(value) => {
                  setStartDateInput(value);
                  setUseStartAt(true);
                }}
                onStartTimeChange={(value) => {
                  setStartTimeInput(value);
                  setUseStartAt(true);
                }}
                onEndDateChange={(value) => {
                  setEndDateInput(value);
                  setUseEndAt(true);
                }}
                onEndTimeChange={(value) => {
                  setEndTimeInput(value);
                  setUseEndAt(true);
                }}
                startAriaLabel={`${t("quickCreate.startAt")} (${locale === "ja" ? "日付" : "date"})`}
                startTimeAriaLabel={`${t("quickCreate.startAt")} (${locale === "ja" ? "時刻" : "time"})`}
                endDateAriaLabel={`${t("quickCreate.endAt")} (${locale === "ja" ? "日付" : "date"})`}
                endTimeAriaLabel={`${t("quickCreate.endAt")} (${locale === "ja" ? "時刻" : "time"})`}
              />
            ) : null}

            <RowToggle
              icon={BookOpen}
              placeholder={t("quickCreate.labelOnly")}
              checked={isLabelOnly}
              onChange={setIsLabelOnly}
            />

            <ProjectRow
              icon={FolderOpen}
              resolvedProject={resolvedProject}
              projectDraft={projectDraft}
              onProjectDraftChange={(value) => {
                setProjectDraft(value);
                setSelectedProject(null);
              }}
              onCommitProject={() => {
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
              isProjectInputFocused={isProjectInputFocused}
              onProjectFocus={() => setIsProjectInputFocused(true)}
              onProjectBlur={() => {
                window.setTimeout(() => setIsProjectInputFocused(false), 100);
              }}
              projectSuggestions={projectSuggestions}
              onPickSuggestion={(project) => {
                setSelectedProject(project);
                setProjectDraft(project);
                setIsProjectInputFocused(false);
              }}
              ariaLabel={t("quickCreate.projectPlaceholder")}
              placeholder={t("quickCreate.projectPlaceholder")}
              createNewLabel={t("quickCreate.createNew")}
            />

            <TagRow
              icon={Tag}
              selectedTags={selectedTags}
              tagDraft={tagDraft}
              onTagDraftChange={setTagDraft}
              onAddTag={() => {
                const normalized = normalizeTag(tagDraft);
                if (!normalized) return;
                const matched = existingTags.find((tag) => equalsIgnoreCase(tag, normalized));
                const next = matched ?? normalized;
                setSelectedTags((prev) =>
                  prev.some((tag) => equalsIgnoreCase(tag, next)) ? prev : [...prev, next],
                );
                setTagDraft("");
              }}
              onRemoveTag={(tag) =>
                setSelectedTags((prev) => prev.filter((item) => !equalsIgnoreCase(item, tag)))
              }
              isTagInputFocused={isTagInputFocused}
              onTagFocus={() => setIsTagInputFocused(true)}
              onTagBlur={() => {
                window.setTimeout(() => setIsTagInputFocused(false), 100);
              }}
              tagSuggestions={tagSuggestions}
              onPickSuggestion={(tag) => {
                setSelectedTags((prev) =>
                  prev.some((item) => equalsIgnoreCase(item, tag)) ? prev : [...prev, tag],
                );
                setTagDraft("");
                setIsTagInputFocused(false);
              }}
              ariaLabel={t("quickCreate.tagsPlaceholder")}
              placeholder={t("quickCreate.tagsPlaceholder")}
              createNewLabel={t("quickCreate.createNew")}
              removeTagLabel={t("quickCreate.removeTag")}
            />

            <MemoRow
              expanded={memoExpanded || memoInput.trim().length > 0}
              memoInput={memoInput}
              onMemoChange={(value) => {
                setMemoInput(value);
                if (value.trim().length === 0) setMemoExpanded(false);
              }}
              onExpand={() => setMemoExpanded(true)}
              placeholder={t("quickCreate.memoPlaceholder")}
              memoAddLabel={t("quickCreate.memoAdd")}
            />

            <FormDivider />

            <RowSubPanel
              icon={Repeat}
              name={t("quickCreate.recurrenceNavTitle")}
              value=""
              onClick={(e) => {
                e.stopPropagation();
                setActivePanel("recurrence");
              }}
            />
            <RowSubPanel
              icon={Ban}
              name={t("quickCreate.interruptNavTitle")}
              value=""
              onClick={(e) => {
                e.stopPropagation();
                setActivePanel("interrupt");
              }}
            />
            <RowSubPanel
              icon={Zap}
              name={t("quickCreate.automationNavTitle")}
              value=""
              onClick={(e) => {
                e.stopPropagation();
                setActivePanel("automation");
              }}
            />
            <RowSubPanel
              icon={Clock4}
              name={t("quickCreate.metaNavTitle")}
              value=""
              onClick={(e) => {
                e.stopPropagation();
                setActivePanel("meta");
              }}
            />
          </FormPanel>
        </div>
        <div className="border-t border-border bg-surface-0 p-section shrink-0">
          <Button
            type="button"
            variant="primary"
            size="large"
            block
            onClick={handleCreate}
            loading={submitting}
            disabled={submitting}
            className="h-10"
          >
            {submitting ? t("quickCreate.saving") : t("quickCreate.commit")}
          </Button>
          {error ? (
            <p id="quick-create-error" role="alert" className="mt-2 text-center text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section className={subPanelClass("recurrence")} data-testid="quick-tile-recurrence-subpanel">
        <QuickTileRecurrenceSubPanel
          onBack={() => setActivePanel("base")}
          onClose={close}
          t={t}
          locale={locale}
          objectiveMode={objectiveMode}
          setObjectiveMode={setObjectiveMode}
          isRecurring={isRecurring}
          showFocusUntilEnd={showFocusUntilEnd}
          recurrenceFrequency={recurrenceFrequency}
          setRecurrenceFrequency={setRecurrenceFrequency}
          recurrenceIntervalInput={recurrenceIntervalInput}
          setRecurrenceIntervalInput={setRecurrenceIntervalInput}
          recurrenceWeekdays={recurrenceWeekdays}
          setRecurrenceWeekdays={setRecurrenceWeekdays}
          recurrenceUseStartAt={recurrenceUseStartAt}
          setRecurrenceUseStartAt={setRecurrenceUseStartAt}
          recurrenceUseEndAt={recurrenceUseEndAt}
          setRecurrenceUseEndAt={setRecurrenceUseEndAt}
          recurrenceStartTimeInput={recurrenceStartTimeInput}
          setRecurrenceStartTimeInput={setRecurrenceStartTimeInput}
          recurrenceEndTimeInput={recurrenceEndTimeInput}
          setRecurrenceEndTimeInput={setRecurrenceEndTimeInput}
          recurrenceValidFromEnabled={recurrenceValidFromEnabled}
          setRecurrenceValidFromEnabled={setRecurrenceValidFromEnabled}
          recurrenceValidToEnabled={recurrenceValidToEnabled}
          setRecurrenceValidToEnabled={setRecurrenceValidToEnabled}
          recurrenceValidFromDateInput={recurrenceValidFromDateInput}
          setRecurrenceValidFromDateInput={setRecurrenceValidFromDateInput}
          recurrenceValidToDateInput={recurrenceValidToDateInput}
          setRecurrenceValidToDateInput={setRecurrenceValidToDateInput}
        />
      </section>

      <section className={subPanelClass("interrupt")} data-testid="quick-tile-interrupt-subpanel">
        <QuickTileInterruptSubPanel
          onBack={() => setActivePanel("base")}
          onClose={close}
          t={t}
          locale={locale}
          interruptPenalty={interruptPenalty}
          setInterruptPenalty={setInterruptPenalty}
          resumePenalty={resumePenalty}
          setResumePenalty={setResumePenalty}
          externalInterruptOnly={externalInterruptOnly}
          setExternalInterruptOnly={setExternalInterruptOnly}
        />
      </section>

      <section className={subPanelClass("automation")} data-testid="quick-tile-automation-subpanel">
        <QuickTileAutomationSubPanel
          onBack={() => setActivePanel("base")}
          onClose={close}
          t={t}
          locale={locale}
          promptOnStart={promptOnStart}
          setPromptOnStart={setPromptOnStart}
          promptOnEnd={promptOnEnd}
          setPromptOnEnd={setPromptOnEnd}
          autoStartAllowed={autoStartAllowed}
          setAutoStartAllowed={setAutoStartAllowed}
          autoEndAllowed={autoEndAllowed}
          setAutoEndAllowed={setAutoEndAllowed}
          timezone={timezone}
          setTimezone={setTimezone}
        />
      </section>

      <section className={subPanelClass("meta")} data-testid="quick-tile-meta-subpanel">
        <QuickTileMetaSubPanel
          onBack={() => setActivePanel("base")}
          onClose={close}
          t={t}
          locale={locale}
          timedLabelDraft={timedLabelDraft}
          setTimedLabelDraft={setTimedLabelDraft}
          timedLabels={timedLabels}
          setTimedLabels={setTimedLabels}
        />
      </section>
    </>
  );
}

// --- inline row subcomponents ------------------------------------------

function DurationRow({
  hours,
  minutes,
  hoursUnit,
  minutesUnit,
  ariaLabel,
  ariaDescribedBy,
  invalid,
  onHoursChange,
  onMinutesChange,
}: {
  hours: string;
  minutes: string;
  hoursUnit: string;
  minutesUnit: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
}) {
  const duration = (() => {
    const h = parseNonNegativeInt(hours) ?? 0;
    const m = parseNonNegativeInt(minutes) ?? 0;
    return formatHHMM(h, m);
  })();
  return (
    <div className="flex items-center gap-control rounded-md border border-border bg-surface-1 px-control py-control">
      <Clock className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
      <div className="flex items-center gap-2 text-sm">
        <input
          type="text"
          inputMode="numeric"
          aria-label={ariaLabel ?? `${hoursUnit} / ${minutesUnit}`}
          aria-invalid={invalid ? "true" : undefined}
          aria-describedby={ariaDescribedBy}
          value={duration}
          onChange={(e) => {
            const parsed = parseHHMM(e.target.value);
            if (!parsed) {
              onHoursChange("0");
              onMinutesChange("0");
              return;
            }
            onHoursChange(String(parsed.hours));
            onMinutesChange(String(parsed.minutes));
          }}
          className="w-20 bg-transparent text-sm text-foreground outline-none"
        />
        <span className="text-foreground-muted">{hoursUnit}</span>
        <span className="text-foreground-muted">/</span>
        <span className="text-foreground-muted">{minutesUnit}</span>
      </div>
    </div>
  );
}

function ScheduleRow(props: {
  scheduleOpen: boolean;
  onToggleSchedule: () => void;
  scheduleSummary: string;
  scheduleTitle: string;
  startDateInput: string;
  startTimeInput: string;
  endDateInput: string;
  endTimeInput: string;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  startAriaLabel: string;
  startTimeAriaLabel: string;
  endDateAriaLabel: string;
  endTimeAriaLabel: string;
}) {
  const {
    scheduleOpen,
    onToggleSchedule,
    scheduleSummary,
    scheduleTitle,
    startDateInput,
    startTimeInput,
    endDateInput,
    endTimeInput,
    onStartDateChange,
    onStartTimeChange,
    onEndDateChange,
    onEndTimeChange,
    startAriaLabel,
    startTimeAriaLabel,
    endDateAriaLabel,
    endTimeAriaLabel,
  } = props;
  return (
    <div>
      <button
        type="button"
        onClick={onToggleSchedule}
        aria-expanded={scheduleOpen}
        aria-label={scheduleTitle}
        className="flex w-full items-center gap-control rounded-md border border-border bg-surface-1 px-control py-control text-left"
      >
        <Calendar className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
        <span className="text-sm">{scheduleSummary}</span>
      </button>
      {scheduleOpen ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              aria-label={startAriaLabel}
              value={startDateInput}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              type="time"
              aria-label={startTimeAriaLabel}
              step={60}
              value={startTimeInput}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              aria-label={endDateAriaLabel}
              value={endDateInput}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              type="time"
              aria-label={endTimeAriaLabel}
              step={60}
              value={endTimeInput}
              onChange={(e) => onEndTimeChange(e.target.value)}
              className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectRow(props: {
  icon: typeof FolderOpen;
  resolvedProject: string;
  projectDraft: string;
  onProjectDraftChange: (value: string) => void;
  onCommitProject: () => void;
  isProjectInputFocused: boolean;
  onProjectFocus: () => void;
  onProjectBlur: () => void;
  projectSuggestions: string[];
  onPickSuggestion: (project: string) => void;
  ariaLabel: string;
  placeholder: string;
  createNewLabel: string;
}) {
  const {
    icon: Icon,
    resolvedProject,
    projectDraft,
    onProjectDraftChange,
    onCommitProject,
    isProjectInputFocused,
    onProjectFocus,
    onProjectBlur,
    projectSuggestions,
    onPickSuggestion,
    ariaLabel,
    placeholder,
    createNewLabel,
  } = props;
  return (
    <div className="space-y-2">
      {resolvedProject ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Tag className="h-3 w-3" aria-hidden="true" />
          {resolvedProject}
        </span>
      ) : null}
      <div className="relative">
        <Input
          leading={<Icon className="h-4 w-4" />}
          value={projectDraft}
          onChange={(e) => onProjectDraftChange(e.target.value)}
          onFocus={onProjectFocus}
          onBlur={onProjectBlur}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            onCommitProject();
          }}
          aria-label={ariaLabel}
          placeholder={placeholder}
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
                    onPickSuggestion(project);
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-surface-1 transition-colors"
                >
                  {project}
                </button>
              ))
            ) : (
              <div className="px-2 py-1.5 text-xs text-foreground-muted">{createNewLabel}</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TagRow(props: {
  icon: typeof Tag;
  selectedTags: string[];
  tagDraft: string;
  onTagDraftChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  isTagInputFocused: boolean;
  onTagFocus: () => void;
  onTagBlur: () => void;
  tagSuggestions: string[];
  onPickSuggestion: (tag: string) => void;
  ariaLabel: string;
  placeholder: string;
  createNewLabel: string;
  removeTagLabel: string;
}) {
  const {
    selectedTags,
    tagDraft,
    onTagDraftChange,
    onAddTag,
    onRemoveTag,
    isTagInputFocused,
    onTagFocus,
    onTagBlur,
    tagSuggestions,
    onPickSuggestion,
    ariaLabel,
    placeholder,
    createNewLabel,
    removeTagLabel,
  } = props;
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          leading={<Plus className="h-4 w-4 text-foreground-muted" aria-hidden="true" />}
          value={tagDraft}
          onChange={(e) => onTagDraftChange(e.target.value)}
          onFocus={onTagFocus}
          onBlur={onTagBlur}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            onAddTag();
          }}
          aria-label={ariaLabel}
          placeholder={placeholder}
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
                    onPickSuggestion(tag);
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-surface-1 transition-colors"
                >
                  {tag}
                </button>
              ))
            ) : (
              <div className="px-2 py-1.5 text-xs text-foreground-muted">{createNewLabel}</div>
            )}
          </div>
        ) : null}
      </div>
      {selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                aria-label={`${removeTagLabel} ${tag}`}
                className="leading-none"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MemoRow(props: {
  expanded: boolean;
  memoInput: string;
  onMemoChange: (value: string) => void;
  onExpand: () => void;
  placeholder: string;
  memoAddLabel: string;
}) {
  const { expanded, memoInput, onMemoChange, onExpand, placeholder, memoAddLabel } = props;
  if (expanded) {
    return (
      <div className="flex items-start gap-control rounded-md border border-border bg-surface-1 px-control py-control">
        <MessageSquare className="mt-1 h-4 w-4 text-foreground-muted" aria-hidden="true" />
        <Textarea
          value={memoInput}
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={3}
          className="min-h-12 flex-1 resize-none border-0 bg-transparent p-0 focus:ring-0"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={placeholder}
      className="flex w-full items-center gap-2 rounded-md border border-border bg-surface-1 px-control py-control"
    >
      <MessageSquare className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
      <span>{memoAddLabel}</span>
    </button>
  );
}

// --- small helpers (preserved from original) ---------------------------
function formatHHMM(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
function parseHHMM(raw: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(raw.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes >= 60) return null;
  return { hours, minutes };
}

// Note: parseTimeToMinutes, parseDateTimeParts, parseBoundedDurationMinutes,
// and formatDateShort are imported from "./build-command" so the build-command
// module remains the single source of truth for these helpers.
