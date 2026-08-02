/**
 * Date / time helpers shared between the tile editor and its panels.
 *
 * Extracted from QuickCreate.tsx during Plan #6 Phase 4 so SchedulePanel
 * (and other panels) can reuse the same parsing / formatting logic without
 * importing from the shell. Pure functions only — no hooks, no state.
 */

import type { Locale } from "@/shared/stores/locale-store";

export type EditorLocale = Locale;

export function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}
