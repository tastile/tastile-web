"use client";

/**
 * AutomationPanel — Recurring life + FrameRule + Flow candidates.
 *
 * Extracted from QuickTileCreate.tsx during Plan #7 Phase 4. Hosts:
 *   - RecurringLifeEditor (active window + state)
 *   - FrameRulesList + FrameRuleRow + renderGeneratorFields
 *   - GeneratorEditor (time_based / focus_block_based)
 *   - WindowEditor (weekday mask + start/end offset)
 *
 * The §5 FormPanel/section wrapper stays in the shell (QuickTileCreate).
 * The `referenceId` text inputs in renderGeneratorFields reference cells are
 * left in place; ReferencePicker will replace them once it is wired up.
 */

import { Calendar, Clock, Plus, Repeat, Type, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { FormRow, FormPanel, RowInput, RowSegmented, SectionHeader } from "@/components/ui/form";
import { HolidayKind, RecurringState, type RecurringStateValue } from "@/lib/domain/v1/constants";
import type {
  CalendarGenerator,
  FrameGenerator,
  FrameRule,
  ReferenceGenerator,
  StepGenerator,
  TransformGenerator,
} from "@/lib/domain/v1/tile";
import type { RecurrenceModel } from "@/lib/domain/tile";
import {
  defaultRecurrenceModel,
  type RecurrenceTemplateRecurrence,
  type RepeatChoice,
} from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";

import {
  type EditorLocale,
  isoToLocalDateTime,
  localDateTimeToIso,
  localDateToIsoDate,
} from "./date-utils";

const FRAME_GENERATOR_KIND_OPTIONS = [
  { value: "step", label: "quickCreate.frameRuleKindStep" },
  { value: "reference", label: "quickCreate.frameRuleKindReference" },
  { value: "calendar", label: "quickCreate.frameRuleKindCalendar" },
  { value: "transform", label: "quickCreate.frameRuleKindTransform" },
] as const;

const CALENDAR_UNIT_OPTIONS = [
  { value: "0", label: "quickCreate.frameRuleUnitDay" },
  { value: "1", label: "quickCreate.frameRuleUnitWeek" },
  { value: "2", label: "quickCreate.frameRuleUnitMonth" },
] as const;

const REFERENCE_ALIGN_OPTIONS = [
  { value: "0", label: "quickCreate.frameRuleAlignStart" },
  { value: "1", label: "quickCreate.frameRuleAlignEnd" },
  { value: "2", label: "quickCreate.frameRuleAlignCenter" },
] as const;

const HOLIDAY_KIND_OPTIONS = [
  { value: String(HolidayKind.NOT_HOLIDAY), label: "quickCreate.frameRuleHolidayNotHoliday" },
  { value: String(HolidayKind.HOLIDAY), label: "quickCreate.frameRuleHolidayHoliday" },
  { value: String(HolidayKind.ANY), label: "quickCreate.frameRuleHolidayAny" },
] as const;

const RECURRING_STATE_OPTIONS: ReadonlyArray<{
  value: RecurringStateValue;
  label: string;
}> = [
  { value: RecurringState.ACTIVE, label: "quickCreate.recurringStateActive" },
  { value: RecurringState.PAUSED, label: "quickCreate.recurringStatePaused" },
  { value: RecurringState.ENDED, label: "quickCreate.recurringStateEnded" },
  {
    value: RecurringState.CANCELLED,
    label: "quickCreate.recurringStateCancelled",
  },
];

// Bit 0 = Sunday … bit 6 = Saturday (matches WindowEditor.weekdayMask convention
// and WEEKDAY_LABELS_SHORT in QuickTileCreate.tsx). Indexed by EditorLocale.
const WEEKDAY_LABELS: Record<EditorLocale, readonly string[]> = {
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

type FrameGeneratorKind = FrameGenerator["kind"];

function defaultFrameGenerator(kind: FrameGeneratorKind): FrameGenerator {
  switch (kind) {
    case "step":
      return { kind: "step", value: { step: 0, origin: null, bounds: null } };
    case "reference":
      return { kind: "reference", value: { referenceId: "", align: 0 } };
    case "calendar":
      return {
        kind: "calendar",
        value: { unit: 0, weekdayMask: null, holidayKind: HolidayKind.ANY },
      };
    case "transform":
      return {
        kind: "transform",
        value: { sourceFrameId: "", shift: null, scale: null },
      };
  }
}

function GeneratorEditor({
  recurrence,
  onChange,
  t,
}: {
  recurrence: RecurrenceModel | RecurrenceTemplateRecurrence | null;
  onChange: (next: RecurrenceModel) => void;
  t: (key: string) => string;
}) {
  if (recurrence === null) {
    return (
      <FormRow icon={<Repeat size={20} />}>
        <Button
          type="button"
          size="small"
          variant="default"
          rounded
          iconLeft={<Plus size={12} aria-hidden="true" />}
          onClick={() => onChange(defaultRecurrenceModel())}
        >
          {t("quickCreate.recurrenceEnable")}
        </Button>
      </FormRow>
    );
  }
  const recurrenceModel = coerceRecurrenceModel(recurrence);
  const generator = recurrenceModel.generator;
  const updateGenerator = (
    updater: (current: RecurrenceModel["generator"]) => RecurrenceModel["generator"],
  ) => {
    onChange({ ...recurrenceModel, generator: updater(generator) });
  };
  return (
    <>
      <RowSegmented
        icon={Repeat}
        options={[
          {
            value: "time_based",
            label: t("quickCreate.generatorTimeBased"),
          },
          {
            value: "focus_block_based",
            label: t("quickCreate.generatorFocusBlockBased"),
          },
        ]}
        value={generator.kind}
        onChange={(value) =>
          updateGenerator(() => {
            if (value === "time_based") {
              return {
                kind: "time_based",
                step_min: 1440,
                anchor_epoch_min: null,
              };
            }
            return {
              kind: "focus_block_based",
              phases: [{ focus_min: 25, break_min: 5 }],
            };
          })
        }
      />
      {generator.kind === "time_based" ? (
        <FormRow icon={<Clock size={20} />}>
          <div className="flex w-full items-center gap-2 text-sm">
            <label className="flex flex-1 items-center gap-1.5">
              <span className="text-foreground-muted">{t("quickCreate.stepMin")}</span>
              <input
                type="number"
                min={1}
                step={1}
                aria-label={t("quickCreate.stepMin")}
                value={generator.step_min}
                onChange={(e) =>
                  updateGenerator((current) => {
                    if (current.kind !== "time_based") return current;
                    return {
                      ...current,
                      step_min: Number(e.target.value) || 1,
                    };
                  })
                }
                className="w-24 rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>
        </FormRow>
      ) : (
        <div className="space-y-2">
          {generator.phases.map((phase, index) => (
            <div
              key={index}
              data-testid={`generator-phase-${index}`}
              className="space-y-1 border-l-2 border-surface-2 pl-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">#{index + 1}</span>
                <button
                  type="button"
                  onClick={() =>
                    updateGenerator((current) => {
                      if (current.kind !== "focus_block_based") return current;
                      return {
                        ...current,
                        phases: current.phases.filter((_, i) => i !== index),
                      };
                    })
                  }
                  aria-label={t("quickCreate.frameRuleRemove")}
                  className="text-foreground-muted hover:text-danger focus:outline-hidden"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-1.5">
                  <span className="text-foreground-muted">{t("quickCreate.focusMin")}</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    aria-label={t("quickCreate.focusMin")}
                    value={phase.focus_min}
                    onChange={(e) =>
                      updateGenerator((current) => {
                        if (current.kind !== "focus_block_based") return current;
                        return {
                          ...current,
                          phases: current.phases.map((p, i) =>
                            i === index ? { ...p, focus_min: Number(e.target.value) || 1 } : p,
                          ),
                        };
                      })
                    }
                    className="w-20 rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-foreground-muted">{t("quickCreate.breakMin")}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={t("quickCreate.breakMin")}
                    value={phase.break_min}
                    onChange={(e) =>
                      updateGenerator((current) => {
                        if (current.kind !== "focus_block_based") return current;
                        return {
                          ...current,
                          phases: current.phases.map((p, i) =>
                            i === index ? { ...p, break_min: Number(e.target.value) || 0 } : p,
                          ),
                        };
                      })
                    }
                    className="w-20 rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="small"
            variant="default"
            rounded
            iconLeft={<Plus size={12} aria-hidden="true" />}
            onClick={() =>
              updateGenerator((current) => {
                if (current.kind !== "focus_block_based") return current;
                return {
                  ...current,
                  phases: [...current.phases, { focus_min: 25, break_min: 5 }],
                };
              })
            }
          >
            {t("quickCreate.addPhase")}
          </Button>
        </div>
      )}
    </>
  );
}

function WindowEditor({
  recurrence,
  onChange,
  t,
  locale,
}: {
  recurrence: RecurrenceModel | RecurrenceTemplateRecurrence | null;
  onChange: (next: RecurrenceModel) => void;
  t: (key: string) => string;
  locale: EditorLocale;
}) {
  if (recurrence === null) {
    return (
      <FormRow icon={<Calendar size={20} />}>
        <Button
          type="button"
          size="small"
          variant="default"
          rounded
          iconLeft={<Plus size={12} aria-hidden="true" />}
          onClick={() => onChange(defaultRecurrenceModel())}
        >
          {t("quickCreate.recurrenceEnable")}
        </Button>
      </FormRow>
    );
  }
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", {
      weekday: "short",
    }),
  );
  const recurrenceModel = coerceRecurrenceModel(recurrence);
  const updateWindow = (
    updater: (current: RecurrenceModel["window"]) => RecurrenceModel["window"],
  ) => {
    onChange({ ...recurrenceModel, window: updater(recurrenceModel.window) });
  };
  const toggleDay = (bit: number) => {
    updateWindow((current) => ({
      ...current,
      weekday_mask: current.weekday_mask ^ (1 << bit),
    }));
  };
  const minutesToHHMM = (totalMinutes: number): string => {
    const clamped = ((totalMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const hhmmToMinutes = (value: string): number => {
    const [hStr = "0", mStr = "0"] = value.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    return h * 60 + m;
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {weekdayLabels.map((label, bit) => {
          const active = (recurrence.window.weekday_mask & (1 << bit)) !== 0;
          return (
            <button
              key={bit}
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={`${t("tiles.weekdayAriaPrefix")} ${label}`}
              onClick={() => toggleDay(bit)}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-md border text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-surface-1 text-foreground-muted hover:bg-surface-2",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1 text-xs">
          <span className="block text-foreground-muted">{t("quickCreate.windowStartAt")}</span>
          <input
            type="time"
            aria-label={t("quickCreate.windowStartAt")}
            value={minutesToHHMM(recurrence.window.start_offset_min)}
            onChange={(e) =>
              updateWindow((current) => ({
                ...current,
                start_offset_min: hhmmToMinutes(e.target.value),
              }))
            }
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="block text-foreground-muted">{t("quickCreate.windowEndAt")}</span>
          <input
            type="time"
            aria-label={t("quickCreate.windowEndAt")}
            value={minutesToHHMM(recurrence.window.end_offset_min)}
            onChange={(e) =>
              updateWindow((current) => ({
                ...current,
                end_offset_min: hhmmToMinutes(e.target.value),
              }))
            }
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
      </div>
    </div>
  );
}

function RecurringLifeEditor({
  activeStart,
  activeEnd,
  state,
  onActiveStartChange,
  onActiveEndChange,
  onStateChange,
  t,
}: {
  activeStart: string;
  activeEnd: string;
  state: RecurringStateValue;
  onActiveStartChange: (value: string) => void;
  onActiveEndChange: (value: string) => void;
  onStateChange: (value: RecurringStateValue) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <FormRow icon={<Calendar size={20} />}>
        <div className="grid w-full grid-cols-2 gap-2">
          <input
            type="date"
            aria-label={t("quickCreate.recurringActiveStart")}
            value={activeStart ? activeStart.slice(0, 10) : ""}
            onChange={(e) => onActiveStartChange(localDateToIsoDate(e.target.value).slice(0, 10))}
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="date"
            aria-label={t("quickCreate.recurringActiveEnd")}
            value={activeEnd ? activeEnd.slice(0, 10) : ""}
            onChange={(e) => onActiveEndChange(localDateToIsoDate(e.target.value).slice(0, 10))}
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </FormRow>
      <RowSegmented
        data-testid="quick-create-recurring-state"
        icon={Repeat}
        options={RECURRING_STATE_OPTIONS.map((opt) => ({
          value: String(opt.value),
          label: t(opt.label),
        }))}
        value={String(state)}
        onChange={(value) => onStateChange(Number(value) as RecurringStateValue)}
      />
    </>
  );
}

function FrameRulesList({
  rules,
  onAdd,
  onRemove,
  onUpdate,
  t,
}: {
  rules: FrameRule[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updater: (current: FrameRule) => FrameRule) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-foreground-muted">
        {t("quickCreate.frameRulesTitle")} ({rules.length})
      </div>
      {rules.map((r, i) => (
        <FrameRuleRow key={r.id} rule={r} index={i} onUpdate={onUpdate} onRemove={onRemove} t={t} />
      ))}
      <Button
        type="button"
        size="small"
        variant="default"
        rounded
        iconLeft={<Plus size={12} aria-hidden="true" />}
        onClick={onAdd}
      >
        {t("quickCreate.frameRulesAdd")}
      </Button>
    </div>
  );
}

function FrameRuleRow({
  rule,
  index,
  onUpdate,
  onRemove,
  t,
}: {
  rule: FrameRule;
  index: number;
  onUpdate: (index: number, updater: (current: FrameRule) => FrameRule) => void;
  onRemove: (index: number) => void;
  t: (key: string) => string;
}) {
  const generatorKind = rule.generator.kind;
  const value = rule.generator.value;
  return (
    <div
      data-testid={`frame-rule-row-${index}`}
      className="space-y-2 border-l-2 border-surface-2 pl-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground-muted">
          {t("quickCreate.frameRulesTitle")} #{index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={t("quickCreate.frameRuleRemove")}
          className="text-foreground-muted hover:text-danger focus:outline-hidden"
        >
          <X size={14} />
        </button>
      </div>
      <RowSegmented
        icon={Repeat}
        options={FRAME_GENERATOR_KIND_OPTIONS.map((opt) => ({
          value: opt.value,
          label: t(opt.label),
        }))}
        value={generatorKind}
        onChange={(value) => {
          const next = value as FrameGeneratorKind;
          if (next === generatorKind) return;
          onUpdate(index, (r) => ({
            ...r,
            generator: defaultFrameGenerator(next),
          }));
        }}
      />
      {renderGeneratorFields({
        kind: generatorKind,
        value,
        onChange: (next) => onUpdate(index, (r) => ({ ...r, generator: next })),
        t,
      })}
    </div>
  );
}

function renderGeneratorFields({
  kind,
  value,
  onChange,
  t,
}: {
  kind: FrameGeneratorKind;
  value: FrameGenerator["value"];
  onChange: (next: FrameGenerator) => void;
  t: (key: string) => string;
}) {
  switch (kind) {
    case "step": {
      const stepValue = value as StepGenerator;
      return (
        <>
          <FormRow icon={<Clock size={20} />}>
            <div className="flex w-full items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5">
                <span className="text-foreground-muted">
                  {t("quickCreate.frameRuleStepMsLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={60000}
                  aria-label={t("quickCreate.frameRuleStepMsLabel")}
                  value={stepValue.step}
                  onChange={(e) =>
                    onChange({
                      kind: "step",
                      value: {
                        ...stepValue,
                        step: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-28 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </div>
          </FormRow>
          <FormRow icon={<Calendar size={20} />}>
            <div className="grid w-full grid-cols-2 gap-2">
              <input
                type="datetime-local"
                aria-label={`${t("quickCreate.frameRuleBoundsLabel")} ${t("quickCreate.startAt")}`}
                value={stepValue.bounds ? isoToLocalDateTime(stepValue.bounds.start) : ""}
                onChange={(e) =>
                  onChange({
                    kind: "step",
                    value: {
                      ...stepValue,
                      bounds: stepValue.bounds
                        ? {
                            ...stepValue.bounds,
                            start: localDateTimeToIso(e.target.value) ?? "",
                          }
                        : {
                            start: localDateTimeToIso(e.target.value) ?? "",
                            end: "",
                          },
                    },
                  })
                }
                className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="datetime-local"
                aria-label={`${t("quickCreate.frameRuleBoundsLabel")} ${t("quickCreate.endAt")}`}
                value={stepValue.bounds ? isoToLocalDateTime(stepValue.bounds.end) : ""}
                onChange={(e) =>
                  onChange({
                    kind: "step",
                    value: {
                      ...stepValue,
                      bounds: stepValue.bounds
                        ? {
                            ...stepValue.bounds,
                            end: localDateTimeToIso(e.target.value) ?? "",
                          }
                        : {
                            start: "",
                            end: localDateTimeToIso(e.target.value) ?? "",
                          },
                    },
                  })
                }
                className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </FormRow>
        </>
      );
    }
    case "reference": {
      const refValue = value as ReferenceGenerator;
      return (
        <>
          <RowInput
            icon={Type}
            placeholder={t("quickCreate.frameRuleReferenceIdLabel")}
            value={refValue.referenceId}
            onChange={(next) =>
              onChange({
                kind: "reference",
                value: { ...refValue, referenceId: next },
              })
            }
            ariaLabel={t("quickCreate.frameRuleReferenceIdLabel")}
          />
          <RowSegmented
            icon={Repeat}
            options={REFERENCE_ALIGN_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            value={String(refValue.align)}
            onChange={(next) =>
              onChange({
                kind: "reference",
                value: { ...refValue, align: Number(next) },
              })
            }
          />
        </>
      );
    }
    case "calendar": {
      const calValue = value as CalendarGenerator;
      return (
        <>
          <RowSegmented
            icon={Calendar}
            options={CALENDAR_UNIT_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            value={String(calValue.unit)}
            onChange={(next) =>
              onChange({
                kind: "calendar",
                value: { ...calValue, unit: Number(next) },
              })
            }
          />
          <FormRow icon={<Calendar size={20} />}>
            <div className="flex w-full items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5">
                <span className="text-foreground-muted">
                  {t("quickCreate.frameRuleWeekdayMaskLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  max={127}
                  step={1}
                  aria-label={t("quickCreate.frameRuleWeekdayMaskLabel")}
                  value={calValue.weekdayMask ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = raw === "" ? null : Number(raw);
                    onChange({
                      kind: "calendar",
                      value: { ...calValue, weekdayMask: next },
                    });
                  }}
                  className="w-20 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </div>
          </FormRow>
          <RowSegmented
            icon={Calendar}
            options={HOLIDAY_KIND_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            value={String(calValue.holidayKind)}
            onChange={(next) =>
              onChange({
                kind: "calendar",
                value: { ...calValue, holidayKind: Number(next) },
              })
            }
          />
        </>
      );
    }
    case "transform": {
      const trValue = value as TransformGenerator;
      return (
        <>
          <RowInput
            icon={Type}
            placeholder={t("quickCreate.frameRuleSourceFrameIdLabel")}
            value={trValue.sourceFrameId}
            onChange={(next) =>
              onChange({
                kind: "transform",
                value: { ...trValue, sourceFrameId: next },
              })
            }
            ariaLabel={t("quickCreate.frameRuleSourceFrameIdLabel")}
          />
          <FormRow icon={<Clock size={20} />}>
            <div className="flex w-full items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5">
                <span className="text-foreground-muted">
                  {t("quickCreate.frameRuleShiftLabel")}
                </span>
                <input
                  type="number"
                  step={60000}
                  aria-label={t("quickCreate.frameRuleShiftLabel")}
                  value={trValue.shift ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onChange({
                      kind: "transform",
                      value: {
                        ...trValue,
                        shift: raw === "" ? null : Number(raw),
                      },
                    });
                  }}
                  className="w-28 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-foreground-muted">
                  {t("quickCreate.frameRuleScaleLabel")}
                </span>
                <input
                  type="number"
                  step={0.1}
                  aria-label={t("quickCreate.frameRuleScaleLabel")}
                  value={trValue.scale ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onChange({
                      kind: "transform",
                      value: {
                        ...trValue,
                        scale: raw === "" ? null : Number(raw),
                      },
                    });
                  }}
                  className="w-20 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </div>
          </FormRow>
        </>
      );
    }
  }
}

// coerceRecurrenceModel accepts both RecurrenceModel and the legacy
// RecurrenceTemplateRecurrence shape (loaded templates may omit newer fields).
// Implementation is co-located in the panel since it is only needed by the
// GeneratorEditor / WindowEditor pair above. Hoist to a shared util when a
// second panel needs it.
function coerceRecurrenceModel(
  recurrence: RecurrenceModel | RecurrenceTemplateRecurrence,
): RecurrenceModel {
  const window = {
    weekday_mask: recurrence.window.weekday_mask,
    start_offset_min: recurrence.window.start_offset_min,
    end_offset_min: recurrence.window.end_offset_min,
    exclusions: "exclusions" in recurrence.window ? recurrence.window.exclusions : [],
  };
  const g = recurrence.generator as Record<string, unknown>;
  let generator: RecurrenceModel["generator"];
  if (g.kind === "focus_block_based" && Array.isArray(g.phases)) {
    generator = {
      kind: "focus_block_based",
      phases: g.phases as Array<{ focus_min: number; break_min: number }>,
    };
  } else {
    generator = {
      kind: "time_based",
      step_min: typeof g.step_min === "number" ? g.step_min : 1440,
      anchor_epoch_min: typeof g.anchor_epoch_min === "number" ? g.anchor_epoch_min : null,
    };
  }
  return {
    generator,
    window,
    selector: { expression: recurrence.selector.expression },
  };
}

type RecurringTab = "lifecycle" | "generator" | "window";

export interface AutomationPanelProps {
  kindIsRecurring: boolean;
  recurring: {
    life: {
      active: { startDate: string; endDate: string };
      state: RecurringStateValue;
    };
    frameRules: FrameRule[];
    repeatMode: RepeatChoice;
    weekdayMask: number;
    endDate: string;
  };
  recurrence: RecurrenceModel | RecurrenceTemplateRecurrence | null;
  recurringTab: RecurringTab;
  setRecurringTab: (tab: RecurringTab) => void;
  setField: (path: string, value: unknown) => void;
  addFrameRule: () => void;
  removeFrameRule: (index: number) => void;
  updateFrameRule: (index: number, updater: (current: FrameRule) => FrameRule) => void;
  locale: EditorLocale;
  t: (key: string) => string;
}

export function AutomationPanel({
  kindIsRecurring,
  recurring,
  recurrence,
  recurringTab,
  setRecurringTab,
  setField,
  addFrameRule,
  removeFrameRule,
  updateFrameRule,
  locale,
  t,
}: AutomationPanelProps) {
  if (!kindIsRecurring) {
    return (
      <FormRow icon={null}>
        <span className="text-xs text-foreground-muted">{t("quickCreate.phaseNotReady")}</span>
      </FormRow>
    );
  }
  return (
    <FormPanel>
      <SectionHeader icon={Repeat} title={t("quickCreate.recurrenceNavTitle")} />
      <div
        role="radiogroup"
        aria-label={t("quickCreate.repeatChip")}
        className="flex flex-wrap gap-1"
        data-testid="recurring-mode-tabs"
      >
        {(
          [
            { id: "once", labelKey: "repeatOnce" },
            { id: "daily", labelKey: "repeatDaily" },
            { id: "weekly", labelKey: "repeatWeekly" },
            { id: "interval", labelKey: "repeatInterval" },
            { id: "condition", labelKey: "repeatCondition" },
          ] as const
        ).map((opt) => {
          const active = recurring.repeatMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`recurring-mode-${opt.id}`}
              onClick={() => setField("recurring.repeatMode", opt.id)}
              className={cn(
                "min-h-[32px] rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-border bg-surface-0 text-foreground-muted hover:bg-surface-1",
              )}
            >
              {t(`quickCreate.${opt.labelKey}`)}
            </button>
          );
        })}
      </div>
      {recurring.repeatMode === "weekly" ? (
        <FormRow icon={<Calendar size={20} />}>
          <div className="flex w-full flex-wrap gap-1" data-testid="recurring-weekday-row">
            {WEEKDAY_LABELS[locale].map((label, bit) => {
              const active = (recurring.weekdayMask & (1 << bit)) !== 0;
              return (
                <button
                  key={bit}
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label={label}
                  data-testid={`recurring-weekday-${bit}`}
                  onClick={() =>
                    setField(
                      "recurring.weekdayMask",
                      recurring.weekdayMask ^ (1 << bit),
                    )
                  }
                  className={cn(
                    "flex h-8 w-9 items-center justify-center rounded-md border text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border bg-surface-1 text-foreground-muted hover:bg-surface-2",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </FormRow>
      ) : null}
      {recurring.repeatMode !== "once" && recurring.repeatMode !== "condition" ? (
        <FormRow icon={<Calendar size={20} />}>
          <input
            type="date"
            aria-label={t("quickCreate.repeatEndDateLabel")}
            value={recurring.endDate ? recurring.endDate.slice(0, 10) : ""}
            onChange={(e) => setField("recurring.endDate", e.target.value)}
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </FormRow>
      ) : null}
      <div
        role="tablist"
        aria-label={t("quickCreate.recurrenceNavTitle")}
        className="flex border-b border-border"
      >
        {(
          [
            { id: "lifecycle", labelKey: "recurringTabLifecycle" },
            { id: "generator", labelKey: "recurringTabGenerator" },
            { id: "window", labelKey: "recurringTabWindow" },
          ] as const
        ).map((tab) => {
          const active = recurringTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setRecurringTab(tab.id)}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-primary text-primary-fg"
                  : "text-foreground-muted hover:bg-surface-2",
              )}
            >
              {t(`quickCreate.${tab.labelKey}`)}
            </button>
          );
        })}
      </div>
      {recurringTab === "lifecycle" ? (
        <>
          <RecurringLifeEditor
            activeStart={recurring.life.active.startDate}
            activeEnd={recurring.life.active.endDate}
            state={recurring.life.state}
            onActiveStartChange={(value) => setField("recurring.life.active.startDate", value)}
            onActiveEndChange={(value) => setField("recurring.life.active.endDate", value)}
            onStateChange={(value) => setField("recurring.life.state", value)}
            t={t}
          />
          <FrameRulesList
            rules={recurring.frameRules}
            onAdd={addFrameRule}
            onRemove={removeFrameRule}
            onUpdate={updateFrameRule}
            t={t}
          />
        </>
      ) : null}
      {recurringTab === "generator" ? (
        <GeneratorEditor
          recurrence={recurrence}
          onChange={(next) => setField("recurrence", next)}
          t={t}
        />
      ) : null}
      {recurringTab === "window" ? (
        <WindowEditor
          recurrence={recurrence}
          onChange={(next) => setField("recurrence", next)}
          t={t}
          locale={locale}
        />
      ) : null}
    </FormPanel>
  );
}
