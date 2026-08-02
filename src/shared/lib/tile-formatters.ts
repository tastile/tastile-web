import type { Locale } from "@/shared/stores/locale-store";
import { DEFAULT_LOCALE } from "@/shared/stores/locale-store";

type FmtOptions = Intl.DateTimeFormatOptions;

const dtFormatters = new Map<string, Intl.DateTimeFormat>();
function getDtFormatter(locale: Locale, opts: FmtOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let fmt = dtFormatters.get(key);
  if (!fmt) {
    const intlLocale =
      locale === "ja"
        ? "ja-JP"
        : locale === "de"
          ? "de-DE"
          : locale === "es"
            ? "es-ES"
            : locale === "fr"
              ? "fr-FR"
              : locale === "ko"
                ? "ko-KR"
                : locale === "zh-CN"
                  ? "zh-CN"
                  : locale === "pt-BR"
                    ? "pt-BR"
                    : "en-US";
    fmt = new Intl.DateTimeFormat(intlLocale, opts);
    dtFormatters.set(key, fmt);
  }
  return fmt;
}

export function formatDuration(minutes: number | null, locale: Locale = DEFAULT_LOCALE): string {
  if (minutes === null || minutes === undefined) return locale === "ja" ? "Not set" : "unspecified";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (locale === "ja") {
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  }

  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function _formatDateTime(
  date: Date | null,
  locale: "ja" | "en" = "ja",
  timeZone?: string | null,
): string {
  if (!date) return locale === "ja" ? "Not set" : "unscheduled";

  return getDtFormatter(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZone ?? undefined,
  }).format(date);
}

export function formatFriendlyDateTime(
  date: Date | null,
  locale: Locale = DEFAULT_LOCALE,
  timeZone?: string | null,
): string {
  if (!date) return locale === "ja" ? "Not set" : "unscheduled";

  const now = new Date();
  const targetDate = new Date(date);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );

  const diffTime = startOfTarget.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const timeStr = getDtFormatter(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timeZone ?? undefined,
  }).format(targetDate);

  if (locale === "ja") {
    if (diffDays === 0) return `Today ${timeStr}`;
    if (diffDays === 1) return `Tomorrow ${timeStr}`;
    if (diffDays === -1) return `Yesterday ${timeStr}`;

    const dayOfWeek = getDtFormatter("ja", {
      weekday: "short",
      timeZone: timeZone ?? undefined,
    }).format(targetDate);
    const dateStr = getDtFormatter("ja", {
      month: "numeric",
      day: "numeric",
      timeZone: timeZone ?? undefined,
    }).format(targetDate);
    return `${dateStr}(${dayOfWeek}) ${timeStr}`;
  }
  if (diffDays === 0) return `Today ${timeStr}`;
  if (diffDays === 1) return `Tomorrow ${timeStr}`;
  if (diffDays === -1) return `Yesterday ${timeStr}`;

  const dateStr = getDtFormatter("en", {
    month: "short",
    day: "numeric",
    timeZone: timeZone ?? undefined,
  }).format(targetDate);
  return `${dateStr} ${timeStr}`;
}

function _formatTimeOnly(
  date: Date | null,
  locale: Locale = DEFAULT_LOCALE,
  timeZone?: string | null,
): string {
  if (!date) return locale === "ja" ? "Not set" : "unscheduled";
  return getDtFormatter(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZone ?? undefined,
  }).format(date);
}

function _getCurrentLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function _getCurrentLocalTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function _parseDateTimeParts(datePart: string, timePart: string): Date | null {
  if (!datePart || !timePart) return null;
  const date = new Date(`${datePart}T${timePart}`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
