"use client";

import { Clock, Repeat } from "lucide-react";
import type { ObjectiveMode } from "@/lib/domain/tile";
import { FormPanel, FormRow, RowInput } from "@/components/ui/form";
import { SubPanelHeader } from "./SubPanelHeader";
import {
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
  return (
    <>
      <SubPanelHeader
        onBack={onBack}
        onClose={onClose}
        title={t("quickCreate.recurrenceNavTitle")}
        locale={locale}
        t={t}
      />
      <div className="flex-1 overflow-y-auto">
        <FormPanel>
          <FormRow icon={<Repeat size={20} />}>
            <div
              role="group"
              className="grid w-full grid-cols-3 gap-control-compact rounded-full border border-border bg-surface-1 p-control-compact"
            >
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
          </FormRow>

          {isRecurring ? (
            <>
              <h3 className="mt-2 mb-2 text-sm font-medium text-foreground">
                {t("quickCreate.recurrenceTitle")}
              </h3>
              <p className="mb-2 text-xs text-foreground-muted">
                {t("quickCreate.recurrenceGuide")}
              </p>
              <FormRow icon={<Repeat size={20} />}>
                <div role="group" className="grid w-full grid-cols-3 gap-2">
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
              </FormRow>
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

              <FormRow icon={<Repeat size={20} />}>
                <div role="group" className="flex w-full gap-1">
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
              </FormRow>

              <FormRow icon={<Clock size={20} />}>
                <div className="flex w-full items-center justify-between">
                  <label
                    htmlFor="recurrence-window-start"
                    className="flex flex-1 cursor-pointer items-center text-sm"
                  >
                    <span>{t("quickCreate.windowStartAt")}</span>
                  </label>
                  <input
                    id="recurrence-window-start"
                    type="checkbox"
                    checked={recurrenceUseStartAt}
                    onChange={(e) => setRecurrenceUseStartAt(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
              </FormRow>
              {recurrenceUseStartAt ? (
                <RowInput
                  icon={Clock}
                  type="time"
                  placeholder={t("quickCreate.windowStartAt")}
                  value={recurrenceStartTimeInput}
                  onChange={(value) => setRecurrenceStartTimeInput(value)}
                  ariaLabel={t("quickCreate.windowStartAt")}
                />
              ) : null}

              <FormRow icon={<Clock size={20} />}>
                <div className="flex w-full items-center justify-between">
                  <label
                    htmlFor="recurrence-window-end"
                    className="flex flex-1 cursor-pointer items-center text-sm"
                  >
                    <span>{t("quickCreate.windowEndAt")}</span>
                  </label>
                  <input
                    id="recurrence-window-end"
                    type="checkbox"
                    checked={recurrenceUseEndAt}
                    onChange={(e) => setRecurrenceUseEndAt(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
              </FormRow>
              {recurrenceUseEndAt ? (
                <RowInput
                  icon={Clock}
                  type="time"
                  placeholder={t("quickCreate.windowEndAt")}
                  value={recurrenceEndTimeInput}
                  onChange={(value) => setRecurrenceEndTimeInput(value)}
                  ariaLabel={t("quickCreate.windowEndAt")}
                />
              ) : null}

              <FormRow icon={<Clock size={20} />}>
                <div className="flex w-full items-center justify-between">
                  <label
                    htmlFor="recurrence-valid-from"
                    className="flex flex-1 cursor-pointer items-center text-sm"
                  >
                    <span>{t("quickCreate.recurrenceValidFrom")}</span>
                  </label>
                  <input
                    id="recurrence-valid-from"
                    type="checkbox"
                    checked={recurrenceValidFromEnabled}
                    onChange={(e) => setRecurrenceValidFromEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
              </FormRow>
              {recurrenceValidFromEnabled ? (
                <RowInput
                  icon={Clock}
                  type="date"
                  placeholder={t("quickCreate.recurrenceValidFrom")}
                  value={recurrenceValidFromDateInput}
                  onChange={(value) => setRecurrenceValidFromDateInput(value)}
                  ariaLabel={t("quickCreate.recurrenceValidFrom")}
                />
              ) : null}

              <FormRow icon={<Clock size={20} />}>
                <div className="flex w-full items-center justify-between">
                  <label
                    htmlFor="recurrence-valid-to"
                    className="flex flex-1 cursor-pointer items-center text-sm"
                  >
                    <span>{t("quickCreate.recurrenceValidTo")}</span>
                  </label>
                  <input
                    id="recurrence-valid-to"
                    type="checkbox"
                    checked={recurrenceValidToEnabled}
                    onChange={(e) => setRecurrenceValidToEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
              </FormRow>
              {recurrenceValidToEnabled ? (
                <RowInput
                  icon={Clock}
                  type="date"
                  placeholder={t("quickCreate.recurrenceValidTo")}
                  value={recurrenceValidToDateInput}
                  onChange={(value) => setRecurrenceValidToDateInput(value)}
                  ariaLabel={t("quickCreate.recurrenceValidTo")}
                />
              ) : null}
            </>
          ) : null}
        </FormPanel>
      </div>
    </>
  );
}
