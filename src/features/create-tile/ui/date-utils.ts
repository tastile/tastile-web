/**
 * Date / time helpers shared between the tile editor and its panels.
 *
 * Extracted from QuickCreate.tsx during Plan #6 Phase 4 so SchedulePanel
 * (and other panels) can reuse the same parsing / formatting logic without
 * importing from the shell. Pure functions only — no hooks, no state.
 *
 * `isoToDate` / `dateToIso` were duplicated inside Event / Task / Recurring
 * during the DateTimeRow extraction; they live here so all consumers pull
 * from one canonical path.
 */

import type { Locale } from "@/shared/stores/locale-store";

export type EditorLocale = Locale;

export function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Parse an ISO string into a `Date`; returns `null` for empty / invalid. */
export function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Convert a `Date` back to an ISO string; returns `""` for `null` / invalid. */
export function dateToIso(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
