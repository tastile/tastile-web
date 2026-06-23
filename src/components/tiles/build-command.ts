import { Actor } from "@/lib/domain/actor";
import { TileId } from "@/lib/domain/ids";
import {
  type DoneRule,
  type ObjectiveMode,
  type RecurrenceGenerator,
  type RecurrenceModel,
  Tile,
} from "@/lib/domain/tile";

export type Locale = "ja" | "en";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export interface QuickCreateFormState {
  title: string;
  isLabelOnly: boolean;
  useStartAt: boolean;
  useEndAt: boolean;
  startDateInput: string;
  startTimeInput: string;
  endDateInput: string;
  endTimeInput: string;
  objectiveMode: ObjectiveMode;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceIntervalInput: string;
  recurrenceWeekdays: number[];
  recurrenceUseStartAt: boolean;
  recurrenceUseEndAt: boolean;
  recurrenceStartTimeInput: string;
  recurrenceEndTimeInput: string;
  recurrenceValidFromEnabled: boolean;
  recurrenceValidToEnabled: boolean;
  recurrenceValidFromDateInput: string;
  recurrenceValidToDateInput: string;
  workHoursInput: string;
  workMinutesInput: string;
  resolvedProject: string;
  selectedTags: string[];
  memoInput: string;
  doneRule: DoneRule;
  interruptPenalty: number;
  resumePenalty: number;
  externalInterruptOnly: boolean;
  promptOnStart: boolean;
  promptOnEnd: boolean;
  autoStartAllowed: boolean;
  autoEndAllowed: boolean;
  timezone: string;
  timedLabels: Array<{ label: string; startAt: Date | null; endAt: Date | null }>;
}

export interface BuildCommandOptions {
  state: QuickCreateFormState;
  effectiveDurationMin: number | null;
  locale: Locale;
}

export interface CreateTileCommand {
  type: "create_tile";
  tile_id: TileId;
  tile: ReturnType<typeof Tile.create>;
}

/**
 * Build the `create_tile` Command payload from the form state.
 *
 * Pure function — no React, no side effects. The component is responsible
 * for wiring this to the execution engine and clearing the form on success.
 */
export function buildCreateTileCommand({
  state,
  effectiveDurationMin,
  locale,
}: BuildCommandOptions): CreateTileCommand {
  const tileId = TileId.new();
  const tile = Tile.create(tileId, state.title.trim());

  if (state.isLabelOnly) {
    tile.objective.objectiveMode = "label_only";
    tile.objective.targetWorkMin = null;
    tile.objective.targetRestMin = null;
    tile.objective.doneRule = null;
  } else {
    tile.objective.objectiveMode = state.objectiveMode;
    tile.objective.targetWorkMin = effectiveDurationMin;
    tile.objective.targetRestMin = null;
    tile.objective.doneRule = state.doneRule;
  }

  tile.objective.recurrence = buildRecurrence(state);

  tile.core.doneDefinition = buildDoneDefinition(state, effectiveDurationMin, locale);

  tile.annotation.labels = buildLabels(state.resolvedProject, state.selectedTags);
  tile.annotation.timedLabels = state.timedLabels
    .filter((entry) => entry.label.trim().length > 0)
    .map((entry) => ({
      label: entry.label.trim(),
      startAt: entry.startAt,
      endAt: entry.endAt,
    }));

  tile.core.nextAction = buildNextAction(state, locale);

  tile.interruption.interruptPenalty = state.interruptPenalty;
  tile.interruption.resumePenalty = state.resumePenalty;
  tile.interruption.externalInterruptOnly = state.externalInterruptOnly;
  // breakSplitsWork is engine-owned and never exposed in UI; keep the
  // Tile.create default (true).

  tile.automation.promptOnStart = state.promptOnStart;
  tile.automation.promptOnEnd = state.promptOnEnd;
  tile.automation.autoStartAllowed = state.autoStartAllowed;
  tile.automation.autoEndAllowed = state.autoEndAllowed;

  tile.temporal.tz = state.timezone.trim() ? state.timezone.trim() : null;

  const startDate = state.useStartAt
    ? parseDateTimeParts(state.startDateInput, state.startTimeInput)
    : null;
  const endDate = state.useEndAt
    ? parseDateTimeParts(state.endDateInput, state.endTimeInput)
    : null;
  const isRecurring = state.objectiveMode === "recurring";

  if (!isRecurring && startDate) {
    tile.temporal.fixedStart = startDate;
    tile.temporal.activeStart = startDate;
  }
  if (!isRecurring && endDate) {
    tile.temporal.fixedEnd = endDate;
    tile.temporal.activeEnd = endDate;
  }
  if (isRecurring && state.recurrenceValidFromEnabled) {
    const validFrom = parseDateTimeParts(state.recurrenceValidFromDateInput, "00:00");
    if (validFrom) tile.temporal.releaseAt = validFrom;
  }
  if (isRecurring && state.recurrenceValidToEnabled) {
    const validTo = parseDateTimeParts(state.recurrenceValidToDateInput, "23:59");
    if (validTo) tile.temporal.dueAt = validTo;
  }

  return {
    type: "create_tile",
    tile_id: tileId,
    tile,
  };
}

function buildRecurrence(state: QuickCreateFormState): RecurrenceModel | null {
  if (state.objectiveMode !== "recurring" || state.isLabelOnly) return null;

  const interval = parseNonNegativeInt(state.recurrenceIntervalInput) ?? 0;
  const anchorDate = state.recurrenceValidFromEnabled
    ? parseDateTimeParts(state.recurrenceValidFromDateInput, "00:00")
    : null;
  const stepMin =
    interval *
    (state.recurrenceFrequency === "weekly"
      ? 7 * 24 * 60
      : state.recurrenceFrequency === "monthly"
        ? 30 * 24 * 60
        : 24 * 60);
  const generator: RecurrenceGenerator = {
    kind: "time_based",
    step_min: stepMin,
    anchor_epoch_min: anchorDate ? Math.floor(anchorDate.getTime() / 60000) : null,
  };
  const startOffsetMin = parseTimeToMinutes(state.recurrenceStartTimeInput);
  const endOffsetMin = parseTimeToMinutes(state.recurrenceEndTimeInput);

  return {
    generator,
    window: {
      weekday_mask: weekdaysToBitmask(state.recurrenceWeekdays),
      start_offset_min:
        state.recurrenceUseStartAt && startOffsetMin !== null ? startOffsetMin : 0,
      end_offset_min:
        state.recurrenceUseEndAt && endOffsetMin !== null ? endOffsetMin : 1440,
      exclusions: [],
    },
    selector: {
      expression: null,
    },
  };
}

function buildDoneDefinition(
  state: QuickCreateFormState,
  effectiveDurationMin: number | null,
  locale: Locale,
): string {
  if (state.isLabelOnly) {
    return locale === "ja"
      ? "指定した期間のラベル付けを完了"
      : "Complete labeling for the selected period";
  }
  if (state.objectiveMode === "recurring") {
    return locale === "ja"
      ? "1サイクル実行したら完了（定期）"
      : "Complete one cycle (recurring)";
  }
  if (state.objectiveMode === "maximize_within_interval") {
    const startDate = state.useStartAt
      ? parseDateTimeParts(state.startDateInput, state.startTimeInput)
      : null;
    const endDate = state.useEndAt
      ? parseDateTimeParts(state.endDateInput, state.endTimeInput)
      : null;
    if (startDate && endDate) {
      return locale === "ja"
        ? `${formatDateShort(startDate, locale)} から ${formatDateShort(endDate, locale)} の間で最大化`
        : `Maximize progress from ${formatDateShort(startDate, locale)} to ${formatDateShort(endDate, locale)}`;
    }
    return locale === "ja" ? "できる限り進める" : "Maximize progress";
  }
  const text = effectiveDurationMin ? formatDuration(effectiveDurationMin, locale) : null;
  if (text) {
    return locale === "ja"
      ? `${text}の実行を完了`
      : `Complete ${text} of work`;
  }
  return locale === "ja" ? "1回の実行を完了" : "Complete one run";
}

function buildNextAction(state: QuickCreateFormState, locale: Locale): string {
  const memo = state.memoInput.trim();
  if (memo) return memo;
  if (state.isLabelOnly) {
    return locale === "ja"
      ? "この期間にラベルを適用"
      : "Apply this label within the selected period";
  }
  return locale === "ja"
    ? "開始して最初の1手を実行"
    : "Start and execute the first step";
}

function buildLabels(projectInput: string, selectedTags: string[]): string[] {
  const labels: string[] = [];
  const project = projectInput.trim();
  if (project) labels.push(`project:${project}`);
  for (const tag of selectedTags) {
    const trimmed = tag.trim();
    if (trimmed) labels.push(trimmed);
  }
  return labels;
}

// --- helpers (formerly inline in QuickTileCreate) ---

export function parseDurationToMinutes(
  hoursValue: string,
  minutesValue: string,
): number | null {
  const hours = parseNonNegativeInt(hoursValue);
  const minutes = parseNonNegativeInt(minutesValue);
  if (hours === null && minutes === null) return null;
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function parseBoundedDurationMinutes(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): number | null {
  const start = parseDateTimeParts(startDate, startTime);
  const end = parseDateTimeParts(endDate, endTime);
  if (!start || !end) return null;
  const diff = Math.floor((end.getTime() - start.getTime()) / 60000);
  return diff > 0 ? diff : null;
}

export function parseDateTimeParts(datePart: string, timePart: string): Date | null {
  if (!datePart || !timePart) return null;
  const date = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseNonNegativeInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function sanitizeNumericInput(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number.parseInt(match[1] ?? "", 10);
  const m = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function weekdaysToBitmask(jsDays: number[]): number {
  let mask = 0;
  for (const d of jsDays) {
    const bit = (d + 6) % 7;
    mask |= 1 << bit;
  }
  return mask;
}

export function formatDuration(totalMinutes: number, locale: Locale): string {
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

export function formatDateShort(date: Date, locale: Locale): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return locale === "ja" ? `${y}/${m}/${d}` : `${m}/${d}/${y}`;
}

export function minutesToHourMinuteStrings(totalMinutes: number): {
  hours: string;
  minutes: string;
} {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours: String(hours), minutes: String(minutes) };
}

export function getCurrentLocalDate(): string {
  return toLocalDateString(new Date());
}

export function getCurrentLocalTime(): string {
  return toLocalTimeString(new Date());
}

export function getLocalTimeAfterMinutes(minutes: number): string {
  return toLocalTimeString(new Date(Date.now() + minutes * 60 * 1000));
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function deriveProjectAndTags(state: {
  tiles: Map<unknown, Tile>;
}): { existingProjects: string[]; existingTags: string[] } {
  const projectSet = new Set<string>();
  const tagSet = new Set<string>();
  for (const tile of state.tiles.values()) {
    for (const label of tile.annotation.labels) {
      if (label.startsWith("project:")) {
        const project = label.slice("project:".length).trim();
        if (project) projectSet.add(project);
      } else {
        tagSet.add(label);
      }
    }
  }
  return {
    existingProjects: Array.from(projectSet).sort(),
    existingTags: Array.from(tagSet).sort(),
  };
}

export function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function equalsIgnoreCase(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export { Actor };
