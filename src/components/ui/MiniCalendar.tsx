"use client";

import { Calendar } from "@mantine/dates";
import { useTranslation } from "@/lib/i18n/use-translation";

interface MiniCalendarProps {
  /** 選択中の日付 (YYYY-MM-DD) */
  selected?: string;
  /** 日付クリック時コールバック */
  onSelect?: (date: string) => void;
  /** 表示中の範囲 (YYYY-MM-DD) を薄い背景で網掛け */
  highlight?: readonly string[];
  /** true にするとクリックを無効化し、視覚的にもロック表示 */
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
