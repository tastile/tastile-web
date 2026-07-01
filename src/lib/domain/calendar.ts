// Calendar event model — drives both the API and the projection.
// Kept intentionally small: enough for a Google-Calendar-style MVP
// (title/description/location, time, all-day, color, recurrence,
// attendees) without dragging in the v1 domain's full Placement
// vocabulary. A future v2 can lift this into a Placement/Tile if
// needed.

export type EventColor =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "pink"
  | "cyan"
  | "yellow"
  | "red"
  | "teal"
  | "indigo"
  | "lime"
  | "gray";

export const EVENT_COLOR_HEX: Record<EventColor, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a855f7",
  orange: "#f97316",
  pink: "#ec4899",
  cyan: "#06b6d4",
  yellow: "#eab308",
  red: "#ef4444",
  teal: "#14b8a6",
  indigo: "#6366f1",
  lime: "#84cc16",
  gray: "#6b7280",
};

export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** ISO date (YYYY-MM-DD) — the last day the rule produces instances. */
  until?: string;
  /** Number of occurrences to generate when `until` is absent. */
  count?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  /** ISO 8601 UTC, e.g. "2026-06-30T09:00:00Z". */
  start: string;
  /** ISO 8601 UTC. For all-day events this is exclusive. */
  end: string;
  allDay: boolean;
  color: EventColor;
  recurrence: RecurrenceRule;
  attendees?: string[];
  /** Optional icon identifier. */
  icon?: string | null;
  /** Optional project label. */
  project?: string | null;
  /** Optional list of tag labels. */
  tags?: string[];
  /** Optional free-form note. */
  memo?: string | null;
  /**
   * Optional provenance tag indicating how this occurrence was produced.
   * `kind`: 0 = MANUAL, 1 = RECURRING, 2 = FLOW, 3 = IMPORT.
   * Surfaced to consumers that need to distinguish recurring-sourced
   * placements from manually-created events (v1 spec §02).
   */
  source?: { kind: number; detail?: string | null } | null;
  /**
   * Tile id for recurring/flow-sourced placements.  The timeline
   * endpoint joins placement -> tile so we can route an edit of a
   * recurring-sourced placement back to the underlying tile
   * (POST /v1/tiles/{tile_id}/update) without a separate lookup.
   */
  tileId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEventInput = Omit<CalendarEvent, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};
