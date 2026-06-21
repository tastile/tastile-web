"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface MiniCalendarProps {
  /** 選択中の日付 (YYYY-MM-DD) */
  selected?: string;
  /** 日付クリック時コールバック */
  onSelect?: (date: string) => void;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MiniCalendar({ selected, onSelect }: MiniCalendarProps) {
  const today = toDateStr(new Date());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  // 月の最初の日
  const firstDay = new Date(viewYear, viewMonth, 1);
  // グリッドの開始日（前月末を含む）
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    cells.push(d);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="select-none px-3 py-2">
      {/* ヘッダー */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Previous month"
          className="rounded p-0.5 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-[11px] font-semibold text-foreground">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          className="rounded p-0.5 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="mb-1 grid grid-cols-7 gap-px">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-[9px] font-semibold uppercase tracking-wider text-foreground-subtle"
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((d) => {
          const str = toDateStr(d);
          const isCurrentMonth = d.getMonth() === viewMonth;
          const isToday = str === today;
          const isSelected = str === selected;

          return (
            <button
              key={str}
              type="button"
              onClick={() => onSelect?.(str)}
              className={cn(
                "flex h-6 w-full items-center justify-center rounded text-[11px] tabular-nums transition-colors",
                !isCurrentMonth && "text-foreground-lighter",
                isCurrentMonth && !isToday && !isSelected && "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
                isToday && !isSelected && "font-semibold text-primary",
                isSelected && "bg-primary text-primary-fg font-semibold",
              )}
              aria-label={str}
              aria-pressed={isSelected}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
