export function formatDuration(minutes: number | null, locale: "ja" | "en" = "ja"): string {
  if (minutes === null || minutes === undefined) return locale === "ja" ? "未設定" : "unspecified";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (locale === "ja") {
    if (hours > 0 && mins > 0) return `${hours}時間${mins}分`;
    if (hours > 0) return `${hours}時間`;
    return `${mins}分`;
  }

  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export function formatDateTime(
  date: Date | null,
  locale: "ja" | "en" = "ja",
  timeZone?: string | null,
): string {
  if (!date) return locale === "ja" ? "未設定" : "unscheduled";

  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZone ?? undefined,
  }).format(date);
}

export function formatFriendlyDateTime(
  date: Date | null,
  locale: "ja" | "en" = "ja",
  timeZone?: string | null,
): string {
  if (!date) return locale === "ja" ? "未設定" : "unscheduled";

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

  const timeStr = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timeZone ?? undefined,
  }).format(targetDate);

  if (locale === "ja") {
    if (diffDays === 0) return `今日 ${timeStr}`;
    if (diffDays === 1) return `明日 ${timeStr}`;
    if (diffDays === -1) return `昨日 ${timeStr}`;

    const dayOfWeek = new Intl.DateTimeFormat("ja-JP", {
      weekday: "short",
      timeZone: timeZone ?? undefined,
    }).format(targetDate);
    const dateStr = new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      timeZone: timeZone ?? undefined,
    }).format(targetDate);
    return `${dateStr}(${dayOfWeek}) ${timeStr}`;
  } else {
    if (diffDays === 0) return `Today ${timeStr}`;
    if (diffDays === 1) return `Tomorrow ${timeStr}`;
    if (diffDays === -1) return `Yesterday ${timeStr}`;

    const dateStr = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: timeZone ?? undefined,
    }).format(targetDate);
    return `${dateStr} ${timeStr}`;
  }
}

export function formatTimeOnly(
  date: Date | null,
  locale: "ja" | "en" = "ja",
  timeZone?: string | null,
): string {
  if (!date) return locale === "ja" ? "未設定" : "unscheduled";
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZone ?? undefined,
  }).format(date);
}

export function getCurrentLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentLocalTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function parseDateTimeParts(datePart: string, timePart: string): Date | null {
  if (!datePart || !timePart) return null;
  const date = new Date(`${datePart}T${timePart}`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
