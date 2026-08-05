/**
 * v1 Window — tastile-core/v1/03-time-and-windows.md
 *
 * Interfaces only. No business logic.
 */

import type { ConditionNode } from "./condition";

// ---------- Span / Range / Moment ----------

export interface Span {
  start: string;
  end: string;
}

export interface DurationRange {
  minMs: number | null;
  maxMs: number | null;
}

interface PointReference {
  /** PLANNED_START=0 | PLANNED_END=1 | ACTUAL_START=2 | ACTUAL_END=3 | FRAME_START=4 | FRAME_END=5 | COMPLETED_AT=6 */
  point: number;
  referenceId: string | null;
}

export interface Moment {
  /** ABSOLUTE=0 | REFERENCE=1 */
  kind: number;
  absolute: string | null;
  reference: PointReference | null;
  offsetMs: number;
}

// ---------- Window ----------

interface WindowRule {
  id: string;
  /** CALENDAR-specific rules: weekdayMask, timeStart, timeEnd, holidayKind. */
  weekdayMask: number | null;
  timeStart: string | null;
  timeEnd: string | null;
  /** NOT_HOLIDAY=0 | HOLIDAY=1 | ANY=2 (HolidayKind) */
  holidayKind: number | null;
  dateRange: DateRange | null;
  /** When this Window is conditional. */
  when: ConditionNode | null;
}

export interface Window {
  id: string;
  owner: string;
  /** CALENDAR=0 | LABEL_SPAN=1 | PARENT_SPAN=2 | GAP=3 */
  kind: number;
  bounds: Span;
  rules: WindowRule[];
  /** Set when kind = LABEL_SPAN / PARENT_SPAN / GAP. */
  referenceId: string | null;
}

// ---------- DateRange ----------

export interface DateRange {
  startDate: string;
  endDate: string;
}
