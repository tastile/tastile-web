/**
 * Date / time helpers shared between the tile editor and its panels.
 *
 * Extracted from QuickTileCreate.tsx during Plan #6 Phase 4 so SchedulePanel
 * (and other panels) can reuse the same parsing / formatting logic without
 * importing from the shell. Pure functions only — no hooks, no state.
 */

export type EditorLocale = "ja" | "en";

export function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function isoToLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateToIsoDate(value: string): string {
  return value ? `${value}T00:00:00.000Z` : "";
}

export function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function formatDisplayDate(
  iso: string | null | undefined,
  allDay: boolean,
  locale: EditorLocale,
  t: (key: string) => string,
): string {
  if (!iso) return t("tiles.notSet");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("tiles.notSet");

  const weekdaysJa = ["日", "月", "火", "水", "木", "金", "土"];
  const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthsEn = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = date.getDay();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  if (locale === "ja") {
    const dayStr = `${month}月${day}日 (${weekdaysJa[weekday]})`;
    return allDay ? dayStr : `${dayStr} ${hours}:${minutes}`;
  }
  const dayStr = `${monthsEn[date.getMonth()]} ${day} (${weekdaysEn[weekday]})`;
  return allDay ? dayStr : `${dayStr}, ${hours}:${minutes}`;
}