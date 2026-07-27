"use client";

import { Calendar } from "@mantine/dates";
import { useTranslation } from "@/lib/i18n/use-translation";

interface MiniCalendarProps {
  /** Currently selected date (YYYY-MM-DD) */
  selected?: string;
  /** Called when the user clicks a date. */
  onSelect?: (date: string) => void;
  /** Dates in this range (YYYY-MM-DD) are tinted in the background. */
  highlight?: readonly string[];
  /** When true, clicks are disabled and the calendar is visually locked. */
  disabled?: boolean;
}

export function MiniCalendar({ selected, onSelect, highlight, disabled }: MiniCalendarProps) {
  const { locale } = useTranslation();
  const today = new Date();
  const highlightSet = highlight ? new Set(highlight) : null;

  return (
    <div className="select-none px-3 py-2">
      <Calendar
        size="xs"
        locale={locale === "ja" ? "ja" : "en"}
        firstDayOfWeek={0}
        date={today}
        level="month"
        getDayProps={(date) => {
          const str = date;
          const isHighlighted = highlightSet?.has(str) ?? false;
          const isSelected = str === selected;
          return {
            selected: isSelected,
            disabled: disabled,
            "data-highlighted": isHighlighted || undefined,
            onClick: () => {
              if (!disabled) onSelect?.(str);
            },
          };
        }}
        styles={{
          month: { padding: 0 },
        }}
      />
    </div>
  );
}
