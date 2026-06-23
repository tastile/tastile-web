"use client";

import { ChevronLeft, X } from "lucide-react";
import type { ObjectiveMode } from "@/lib/domain/tile";
import {
  getCurrentLocalDate as getCurrentLocalDateHelper,
  parseNonNegativeInt,
  sanitizeNumericInput,
  type RecurrenceFrequency,
} from "../build-command";

const WEEKDAY_LABELS: Record<"ja" | "en", string[]> = {
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const FREQ_OPTIONS: RecurrenceFrequency[] = ["daily", "weekly", "monthly"];

interface Props {
  onBack: () => void;
  onClose: () => void;
  t: (key: string) => string;
  locale: "ja" | "en";
  objectiveMode: ObjectiveMode;
  setObjectiveMode: (mode: ObjectiveMode) => void;
  isRecurring: boolean;
  showFocusUntilEnd: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  setRecurrenceFrequency: (f: RecurrenceFrequency) => void;
  recurrenceIntervalInput: string;
  setRecurrenceIntervalInput: (v: string) => void;
  recurrenceWeekdays: number[];
  setRecurrenceWeekdays: (w: number[]) => void;
  recurrenceUseStartAt: boolean;
  setRecurrenceUseStartAt: (v: boolean) => void;
  recurrenceUseEndAt: boolean;
  setRecurrenceUseEndAt: (v: boolean) => void;
  recurrenceStartTimeInput: string;
  setRecurrenceStartTimeInput: (v: string) => void;
  recurrenceEndTimeInput: string;
  setRecurrenceEndTimeInput: (v: string) => void;
  recurrenceValidFromEnabled: boolean;
  setRecurrenceValidFromEnabled: (v: boolean) => void;
  recurrenceValidToEnabled: boolean;
  setRecurrenceValidToEnabled: (v: boolean) => void;
  recurrenceValidFromDateInput: string;
  setRecurrenceValidFromDateInput: (v: string) => void;
  recurrenceValidToDateInput: string;
  setRecurrenceValidToDateInput: (v: string) => void;
  getCurrentLocalDate: () => string;
}

export function QuickTileRecurrenceSubPanel({
  onBack,
  onClose,
  t,
  locale,
  objectiveMode,
  setObjectiveMode,
  isRecurring,
  showFocusUntilEnd,
  recurrenceFrequency,
  setRecurrenceFrequency,
  recurrenceIntervalInput,
  setRecurrenceIntervalInput,
  recurrenceWeekdays,
  setRecurrenceWeekdays,
  recurrenceUseStartAt,
  setRecurrenceUseStartAt,
  recurrenceUseEndAt,
  setRecurrenceUseEndAt,
  recurrenceStartTimeInput,
  setRecurrenceStartTimeInput,
  recurrenceEndTimeInput,
  setRecurrenceEndTimeInput,
  recurrenceValidFromEnabled,
  setRecurrenceValidFromEnabled,
  recurrenceValidToEnabled,
  setRecurrenceValidToEnabled,
  recurrenceValidFromDateInput,
  setRecurrenceValidFromDateInput,
  recurrenceValidToDateInput,
  setRecurrenceValidToDateInput,
}: Props) {
  void getCurrentLocalDateHelper; // referenced through props
  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-section">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("quickCreate.back")}
        </button>
        <h2 className="text-base font-semibold text-foreground">
          {t("quickCreate.recurrenceNavTitle")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={locale === "ja" ? "パネルを閉じる" : "Close panel"}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-section">
        <div className="space-y-section">
          <div className="grid grid-cols-3 gap-control-compact rounded-full border border-border bg-surface-1 p-control-compact">
            <button
              type="button"
              onClick={() => setObjectiveMode("finish_once")}
              aria-pressed={objectiveMode === "finish_once"}
              className="rounded-full px-3 py-1.5 text-sm"
            >
              {t("quickCreate.objectiveFinish")}
            </button>
            <button
              type="button"
              onClick={() => setObjectiveMode("recurring")}
              aria-pressed={objectiveMode === "recurring"}
              className="rounded-full px-3 py-1.5 text-sm"
            >
              {t("quickCreate.objectiveRecurring")}
            </button>
            {showFocusUntilEnd ? (
              <button
                type="button"
                onClick={() =>
                  setObjectiveMode(
                    objectiveMode === "maximize_within_interval"
                      ? "finish_once"
                      : "maximize_within_interval",
                  )
                }
                aria-pressed={objectiveMode === "maximize_within_interval"}
                className="rounded-full px-3 py-1.5 text-sm"
              >
                {t("quickCreate.objectiveMaximize")}
              </button>
            ) : null}
          </div>

          {isRecurring ? (
            <div className="space-y-section">
              <div>
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  {t("quickCreate.recurrenceTitle")}
                </h3>
                <p className="mb-2 text-xs text-foreground-muted">
                  {t("quickCreate.recurrenceGuide")}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {FREQ_OPTIONS.map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setRecurrenceFrequency(freq)}
                      aria-pressed={recurrenceFrequency === freq}
                      className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm"
                    >
                      {t(`quickCreate.recurrenceFreq${freq.charAt(0).toUpperCase()}${freq.slice(1)}`)}
                    </button>
                  ))}
                </div>
                <label className="mt-2 block space-y-1">
                  <span className="text-xs text-foreground-muted">
                    {t("quickCreate.recurrenceInterval")}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={recurrenceIntervalInput}
                    onChange={(e) =>
                      setRecurrenceIntervalInput(sanitizeNumericInput(e.target.value))
                    }
                    onBlur={() => {
                      const n = parseNonNegativeInt(recurrenceIntervalInput) ?? 0;
                      if (n <= 0) setRecurrenceIntervalInput("1");
                    }}
                    className="w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-foreground">{t("quickCreate.recurrenceTitle")}</h3>
                <div className="flex gap-1">
                  {WEEKDAY_LABELS[locale].map((label, idx) => {
                    const active = recurrenceWeekdays.includes(idx);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          setRecurrenceWeekdays(
                            active
                              ? recurrenceWeekdays.filter((d) => d !== idx)
                              : [...recurrenceWeekdays, idx],
                          )
                        }
                        aria-pressed={active}
                        className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-xs"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recurrenceUseStartAt}
                  onChange={(e) => setRecurrenceUseStartAt(e.target.checked)}
                />
                <span>{t("quickCreate.windowStartAt")}</span>
              </label>
              {recurrenceUseStartAt ? (
                <input
                  type="time"
                  step={60}
                  value={recurrenceStartTimeInput}
                  onChange={(e) => setRecurrenceStartTimeInput(e.target.value)}
                  className="themed-datetime-input rounded-md bg-surface-2 px-control py-control text-sm"
                />
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recurrenceUseEndAt}
                  onChange={(e) => setRecurrenceUseEndAt(e.target.checked)}
                />
                <span>{t("quickCreate.windowEndAt")}</span>
              </label>
              {recurrenceUseEndAt ? (
                <input
                  type="time"
                  step={60}
                  value={recurrenceEndTimeInput}
                  onChange={(e) => setRecurrenceEndTimeInput(e.target.value)}
                  className="themed-datetime-input rounded-md bg-surface-2 px-control py-control text-sm"
                />
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recurrenceValidFromEnabled}
                  onChange={(e) => setRecurrenceValidFromEnabled(e.target.checked)}
                />
                <span>{t("quickCreate.recurrenceValidFrom")}</span>
              </label>
              {recurrenceValidFromEnabled ? (
                <input
                  type="date"
                  value={recurrenceValidFromDateInput}
                  onChange={(e) => setRecurrenceValidFromDateInput(e.target.value)}
                  className="themed-datetime-input rounded-md bg-surface-2 px-control py-control text-sm"
                />
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recurrenceValidToEnabled}
                  onChange={(e) => setRecurrenceValidToEnabled(e.target.checked)}
                />
                <span>{t("quickCreate.recurrenceValidTo")}</span>
              </label>
              {recurrenceValidToEnabled ? (
                <input
                  type="date"
                  value={recurrenceValidToDateInput}
                  onChange={(e) => setRecurrenceValidToDateInput(e.target.value)}
                  className="themed-datetime-input rounded-md bg-surface-2 px-control py-control text-sm"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
