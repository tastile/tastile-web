import { translations } from "@/shared/i18n/translations";
import type { Locale } from "@/shared/stores/locale-store";
import type { RepeatChoice } from "@/shared/stores/quick-create-store";
import { Calendar } from "lucide-react";

// Bit 0 = Sunday … bit 6 = Saturday (matches WindowEditor.weekdayMask convention).
type LocaleTree = { weekdays: readonly string[] };
const jaTree = translations.ja as unknown as LocaleTree;
const enTree = translations.en as unknown as LocaleTree;
export function weekdayLabelsFor(locale: Locale): readonly string[] {
  if (locale === "ja") return jaTree.weekdays;
  return enTree.weekdays;
}

export const REPEAT_MODE_LABEL_KEY: Record<RepeatChoice, string> = {
  once: "quickCreate.repeatOnce",
  daily: "quickCreate.repeatDaily",
  weekly: "quickCreate.repeatWeekly",
  monthly: "quickCreate.repeatMonthly",
  interval: "quickCreate.repeatInterval",
  condition: "quickCreate.repeatCondition",
};

export const INTENT_ITEMS = [
  {
    key: "time",
    icon: Calendar,
    panel: "time" as const,
    titleKey: "quickCreate.intentNarrowTime",
    subKey: "quickCreate.intentNarrowTimeSub",
  },
  {
    key: "references",
    icon: Calendar,
    panel: "references" as const,
    titleKey: "quickCreate.intentReferenceTile",
    subKey: "quickCreate.intentReferenceTileSub",
  },
  {
    key: "recurring",
    icon: Calendar,
    panel: "recurring" as const,
    titleKey: "quickCreate.intentNestStructure",
    subKey: "quickCreate.intentNestStructureSub",
  },
  {
    key: "placement",
    icon: Calendar,
    panel: "meta" as const,
    titleKey: "quickCreate.intentAdjustPlacement",
    subKey: "quickCreate.intentAdjustPlacementSub",
  },
  {
    key: "completion",
    icon: Calendar,
    panel: "completion" as const,
    titleKey: "quickCreate.intentCombineConditions",
    subKey: "quickCreate.intentCombineConditionsSub",
  },
  {
    key: "addCompletion",
    icon: Calendar,
    panel: "completion" as const,
    titleKey: "quickCreate.intentAddCompletion",
    subKey: "quickCreate.intentAddCompletionSub",
  },
  {
    key: "onSuccess",
    icon: Calendar,
    panel: "meta" as const,
    titleKey: "quickCreate.intentDefineOnSuccess",
    subKey: "quickCreate.intentDefineOnSuccessSub",
  },
] as const;

function _localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function _isoToLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function _localDateToIsoDate(value: string): string {
  return value ? `${value}T00:00:00.000Z` : "";
}

function _isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const jaDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

export function formatDisplayDate(
  iso: string | null | undefined,
  allDay: boolean,
  locale: Locale,
  t: (key: string) => string,
): string {
  if (!iso) return t("tiles.notSet");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("tiles.notSet");

  const localeTree = translations[locale] as unknown as {
    weekdays: readonly string[];
    months: readonly string[];
  };
  const weekdays = localeTree.weekdays;
  const months = localeTree.months;

  const day = date.getDate();
  const weekday = date.getDay();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  if (locale === "ja") {
    const dayStr = jaDateTimeFormatter.format(date);
    return allDay ? dayStr : `${dayStr} ${hours}:${minutes}`;
  }
  const dayStr = `${months[date.getMonth()]} ${day} (${weekdays[weekday]})`;
  return allDay ? dayStr : `${dayStr}, ${hours}:${minutes}`;
}

export function parseTimeToPercent(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  return ((hours * 60 + minutes) / (24 * 60)) * 100;
}
