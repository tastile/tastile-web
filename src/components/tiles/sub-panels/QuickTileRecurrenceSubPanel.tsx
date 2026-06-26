"use client";

import { ChevronRight, Clock, Repeat } from "lucide-react";
import { FormPanel, RowInput, RowSegmented, RowToggle } from "@/components/ui/form";
import type { ObjectiveMode } from "@/lib/domain/tile";
import {
  parseNonNegativeInt,
  type RecurrenceFrequency,
  sanitizeNumericInput,
} from "../build-command";
import { SubPanelHeader } from "./SubPanelHeader";

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
          <RowSegmented
            icon={Repeat}
            options={[
              { value: "finish_once", label: t("quickCreate.objectiveFinish") },
              { value: "recurring", label: t("quickCreate.objectiveRecurring") },
              ...(showFocusUntilEnd
                ? [{ value: "maximize_within_interval", label: t("quickCreate.objectiveMaximize") }]
                : []),
            ]}
            value={objectiveMode}
            onChange={(v) => setObjectiveMode(v as ObjectiveMode)}
          />

          {isRecurring ? (
            <>
              <h3 className="mt-2 mb-2 text-sm font-medium text-foreground">
                {t("quickCreate.recurrenceTitle")}
              </h3>
              <p className="mb-2 text-xs text-foreground-muted">
                {t("quickCreate.recurrenceGuide")}
              </p>
              <RowSegmented
                icon={Repeat}
                options={FREQ_OPTIONS.map((freq) => ({
                  value: freq,
                  label: t(
                    `quickCreate.recurrenceFreq${freq.charAt(0).toUpperCase()}${freq.slice(1)}`,
                  ),
                }))}
                value={recurrenceFrequency}
                onChange={(v) => setRecurrenceFrequency(v as RecurrenceFrequency)}
              />
              <label className="mt-2 block space-y-1">
                <span className="text-xs text-foreground-muted">
                  {t("quickCreate.recurrenceInterval")}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={recurrenceIntervalInput}
                  onChange={(e) => setRecurrenceIntervalInput(sanitizeNumericInput(e.target.value))}
                  onBlur={() => {
                    const n = parseNonNegativeInt(recurrenceIntervalInput) ?? 0;
                    if (n <= 0) setRecurrenceIntervalInput("1");
                  }}
                  className="w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              <fieldset
                aria-label={t("quickCreate.recurrenceTitle")}
                className="flex w-full rounded-md bg-surface-2 p-0.5 border-0 p-0 m-0"
              >
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
                      className={
                        active
                          ? "flex-1 rounded-sm bg-primary px-2 py-1.5 text-xs text-primary-fg shadow-sm"
                          : "flex-1 rounded-sm px-2 py-1.5 text-xs text-foreground-muted hover:text-foreground"
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </fieldset>

              <RowToggle
                icon={Clock}
                placeholder={t("quickCreate.windowStartAt")}
                checked={recurrenceUseStartAt}
                onChange={setRecurrenceUseStartAt}
              />
              {recurrenceUseStartAt ? (
                <RowInput
                  icon={ChevronRight}
                  type="time"
                  placeholder={t("quickCreate.windowStartAt")}
                  value={recurrenceStartTimeInput}
                  onChange={(value) => setRecurrenceStartTimeInput(value)}
                  ariaLabel={t("quickCreate.windowStartAt")}
                />
              ) : null}

              <RowToggle
                icon={Clock}
                placeholder={t("quickCreate.windowEndAt")}
                checked={recurrenceUseEndAt}
                onChange={setRecurrenceUseEndAt}
              />
              {recurrenceUseEndAt ? (
                <RowInput
                  icon={ChevronRight}
                  type="time"
                  placeholder={t("quickCreate.windowEndAt")}
                  value={recurrenceEndTimeInput}
                  onChange={(value) => setRecurrenceEndTimeInput(value)}
                  ariaLabel={t("quickCreate.windowEndAt")}
                />
              ) : null}

              <RowToggle
                icon={Clock}
                placeholder={t("quickCreate.recurrenceValidFrom")}
                checked={recurrenceValidFromEnabled}
                onChange={setRecurrenceValidFromEnabled}
              />
              {recurrenceValidFromEnabled ? (
                <RowInput
                  icon={ChevronRight}
                  type="date"
                  placeholder={t("quickCreate.recurrenceValidFrom")}
                  value={recurrenceValidFromDateInput}
                  onChange={(value) => setRecurrenceValidFromDateInput(value)}
                  ariaLabel={t("quickCreate.recurrenceValidFrom")}
                />
              ) : null}

              <RowToggle
                icon={Clock}
                placeholder={t("quickCreate.recurrenceValidTo")}
                checked={recurrenceValidToEnabled}
                onChange={setRecurrenceValidToEnabled}
              />
              {recurrenceValidToEnabled ? (
                <RowInput
                  icon={ChevronRight}
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
