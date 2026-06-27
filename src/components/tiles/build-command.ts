import {
  type DoneRule,
  type ObjectiveMode,
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

// --- helpers (formerly inline in QuickTileCreate) ---

export function parseDurationToMinutes(hoursValue: string, minutesValue: string): number | null {
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

export function deriveProjectAndTags(state: { tiles: Map<unknown, Tile> }): {
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
