"use client";

/**
 * SourceGenerationPanel — recurring source-generation authoring surface
 * extracted from AutomationPanel during Plan #6 (Tastile web study-life
 * completion, path-first scenario A).
 *
 * The UX is intentionally a faithful re-implementation of the recurrence
 * controls that already live in `AutomationPanel.tsx`:
 *   - Occurrence: 5-way choice tab (once / daily / weekly / interval / condition)
 *   - Weekday: chip row with bit-0 = Sunday … bit-6 = Saturday, shown when
 *     repeatMode === "weekly" (matches the AutomationPanel precedent)
 *   - End: explicit Switch (off = no end; on reveals a date picker)
 *
 * The panel is store-agnostic: it does NOT call `useQuickCreateStore`
 * directly. The orchestrator (QuickCreate) reads the store slice and
 * passes it down via `recurring` + `setField`. This keeps the panel
 * reusable for tests and for any future "edit" mode that wants to bind
 * it to a different form context.
 *
 * data-testid contract (preserved from AutomationPanel so any future
 * Playwright scenario-A selectors work against either component):
 *   - recurring-mode-tabs
 *   - recurring-weekday-row
 *   - recurring-weekday-{bit}     (bit 0 = Sunday)
 *   - recurring-end-switch
 *   - recurring-condition-affordance  (E1b — disabled, tooltip-only)
 */

import { translations } from "@/shared/i18n/translations";
import type { ConditionNode } from "@/shared/model/v1/condition";
import { ConditionKind, TileKind } from "@/shared/model/v1/constants";
import { FormRow } from "@/shared/ui/form";
import { SEGMENT_STYLES } from "@/shared/ui/panel-styles";
import { Button, Chip, NumberInput, SegmentedControl, Switch, Tooltip } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { Calendar, CalendarDays, Filter, Repeat, Timer } from "lucide-react";
import { ConditionEditor } from "./ConditionEditor";
import type { EditorLocale } from "./date-utils";
import { defaultTerm } from "./default-term";

/**
 * E1b — exact tooltip text shown on the disabled recurring.condition
 * affordance. Kept as a constant so the test can match it without relying
 * on translations (which the panel renders via the `t` prop).
 */
export const RECURRING_CONDITION_DISABLED_TOOLTIP = "Condition editor ships in Phase 4";

// Bit 0 = Sunday … bit 6 = Saturday (matches WindowEditor.weekdayMask
// convention). Locale-specific labels live in translations.ts so no JA
// characters appear in this source file. Non-ja / non-en placeholder
// locales all fall back to the English array.
type LocaleTree = { weekdays: readonly string[] };
const jaTree = translations.ja as unknown as LocaleTree;
const enTree = translations.en as unknown as LocaleTree;
const WEEKDAY_LABELS: Record<EditorLocale, readonly string[]> = {
  ja: jaTree.weekdays,
  en: enTree.weekdays,
  es: enTree.weekdays,
  ko: enTree.weekdays,
  "zh-CN": enTree.weekdays,
};

const REPEAT_MODE_OPTIONS = [
  { id: "once", labelKey: "repeatOnce" },
  { id: "daily", labelKey: "repeatDaily" },
  { id: "weekly", labelKey: "repeatWeekly" },
  { id: "monthly", labelKey: "repeatMonthly" },
  { id: "interval", labelKey: "repeatInterval" },
  { id: "condition", labelKey: "repeatCondition" },
] as const;

type RepeatMode = (typeof REPEAT_MODE_OPTIONS)[number]["id"];

function BuilderLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <FormRow icon={null} className="items-start">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">{title}</span>
        {hint ? <span className="text-xs text-foreground-muted">{hint}</span> : null}
      </div>
    </FormRow>
  );
}

function WeekdayRow({
  mask,
  onToggle,
  locale,
}: {
  mask: number;
  onToggle: (bit: number) => void;
  locale: EditorLocale;
}) {
  return (
    <div className="flex flex-wrap gap-1" data-testid="recurring-weekday-row">
      {WEEKDAY_LABELS[locale].map((label, bit) => {
        const active = (mask & (1 << bit)) !== 0;
        return (
          <Chip
            key={bit}
            checked={active}
            onChange={() => onToggle(bit)}
            size="xs"
            variant="light"
            data-testid={`recurring-weekday-${bit}`}
          >
            {label}
          </Chip>
        );
      })}
    </div>
  );
}

function EndDateToggle({
  endDate,
  onChange,
  t,
}: {
  endDate: string;
  onChange: (next: string) => void;
  t: (key: string) => string;
}) {
  const hasEndDate = Boolean(endDate);
  const handleToggle = (next: boolean) => {
    if (next) {
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00:00.000Z`;
      onChange(iso);
    } else {
      onChange("");
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-0 p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Calendar size={16} aria-hidden="true" className="text-foreground-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">
              {t("quickCreate.repeatEndLabel")}
            </div>
            <div className="text-[10px] text-foreground-muted">
              {hasEndDate ? t("quickCreate.repeatEndSetSub") : t("quickCreate.repeatEndNoneSub")}
            </div>
          </div>
        </div>
        <Switch
          size="sm"
          aria-label={t("quickCreate.repeatEndLabel")}
          checked={hasEndDate}
          onChange={(event) => handleToggle(event.currentTarget.checked)}
          data-testid="recurring-end-switch"
        />
      </div>
      {hasEndDate ? (
        <DatePickerInput
          aria-label={t("quickCreate.repeatEndLabel")}
          value={endDate ? endDate.slice(0, 10) : null}
          onChange={(value) => onChange(value ? `${value}T00:00:00.000Z` : "")}
          clearable
          size="xs"
          popoverProps={{ withinPortal: false }}
        />
      ) : null}
    </div>
  );
}

export interface SourceGenerationPanelProps {
  /** Form-state slice that owns the recurrence authoring surface. */
  recurring: {
    repeatMode: RepeatMode;
    weekdayMask: number;
    endDate: string;
    intervalValue: number;
    intervalUnit: "min" | "hour" | "day";
    condition: ConditionNode | null;
  };
  /**
   * Patched-through store setter. The orchestrator binds this to
   * `useQuickCreateStore((s) => s.setField)`; the panel itself is
   * store-agnostic.
   */
  setField: (path: string, value: unknown) => void;
  /** UI locale for weekday labels. */
  locale: EditorLocale;
  /** Translation lookup. */
  t: (key: string) => string;
  /** Current timeOfDay settings, surfaced when interval mode joins the panel. */
  timeOfDayStart?: string;
  timeOfDayEnd?: string;
}

export function SourceGenerationPanel({
  recurring,
  setField,
  locale,
  t,
  timeOfDayStart,
  timeOfDayEnd,
}: SourceGenerationPanelProps) {
  const weekdayEnabled = recurring.repeatMode === "weekly";
  const intervalEnabled = recurring.repeatMode === "interval";
  const conditionEnabled = recurring.repeatMode === "condition";
  return (
    <div className="space-y-3">
      <FormRow icon={<Repeat className="h-4 w-4" aria-hidden />}>
        <span className="text-xs font-medium">{t("quickCreate.recurrenceNavTitle")}</span>
      </FormRow>
      <SegmentedControl
        fullWidth
        size="sm"
        radius="md"
        withItemsBorders={false}
        value={recurring.repeatMode}
        onChange={(value) => {
          setField("recurring.repeatMode", value);
          if (value !== "once") {
            setField("identity.kind", TileKind.RECURRING);
          }
        }}
        data={REPEAT_MODE_OPTIONS.map((opt) => ({
          value: opt.id,
          label: t(`quickCreate.${opt.labelKey}`),
        }))}
        styles={SEGMENT_STYLES}
        data-testid="recurring-mode-tabs"
      />
      {weekdayEnabled && (
        <FormRow icon={<CalendarDays className="h-4 w-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.repeatWeekdayLabel")}</span>
            <WeekdayRow
              mask={recurring.weekdayMask}
              onToggle={(bit) =>
                setField("recurring.weekdayMask", recurring.weekdayMask ^ (1 << bit))
              }
              locale={locale}
            />
          </div>
        </FormRow>
      )}
      {intervalEnabled && (
        <FormRow icon={<Timer className="h-4 w-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.intervalLabel") ?? "Interval"}</span>
            <div className="flex items-center gap-2">
              <NumberInput
                min={recurring.intervalUnit === "min" ? 5 : 1}
                step={recurring.intervalUnit === "min" ? 5 : 1}
                value={recurring.intervalValue}
                onChange={(value) => {
                  const num = typeof value === "number" ? value : Number(value);
                  if (!Number.isFinite(num)) return;
                  const min = recurring.intervalUnit === "min" ? 5 : 1;
                  setField("recurring.intervalValue", Math.max(min, Math.min(365, num)));
                }}
                size="sm"
                className="flex-1"
                aria-label={t("quickCreate.intervalLabel") ?? "Interval"}
                styles={{ input: { backgroundColor: "var(--surface-2)" } }}
              />
              <SegmentedControl
                size="xs"
                radius="md"
                withItemsBorders={false}
                value={recurring.intervalUnit}
                onChange={(value) => {
                  const next = value as "min" | "hour" | "day";
                  const defaults: Record<"min" | "hour" | "day", number> = {
                    min: 30,
                    hour: 1,
                    day: 1,
                  };
                  setField("recurring.intervalUnit", next);
                  if (
                    (next === "min" && recurring.intervalValue < 5) ||
                    (next === "hour" && recurring.intervalValue > 24) ||
                    (next === "day" && recurring.intervalValue > 31)
                  ) {
                    setField("recurring.intervalValue", defaults[next]);
                  }
                }}
                data={[
                  { value: "min", label: "min" },
                  { value: "hour", label: "h" },
                  { value: "day", label: "d" },
                ]}
                styles={SEGMENT_STYLES}
              />
            </div>
            {timeOfDayStart && recurring.intervalUnit === "day" ? (
              <div className="rounded bg-surface-2 px-2 py-1.5 text-xs text-foreground-muted flex items-center gap-1.5">
                <Calendar size={12} aria-hidden="true" />
                <span>
                  時間帯: {timeOfDayStart}
                  {timeOfDayEnd ? ` → ${timeOfDayEnd}` : ""}
                </span>
              </div>
            ) : null}
          </div>
        </FormRow>
      )}
      {conditionEnabled && (
        <FormRow icon={<Filter className="h-4 w-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">{t("quickCreate.conditionModeLabel") ?? "繰り返し条件"}</span>
            {t("quickCreate.conditionModeHint") ? (
              <span className="text-xs text-foreground-muted">{t("quickCreate.conditionModeHint")}</span>
            ) : null}
          {/* E1b — recurring.condition affordance is kept (not removed) so users
              see the slot exists, but every interaction is disabled while
              ConditionEditor (Phase 4) is not yet wired. The wrapper span
              ensures the Mantine Tooltip fires even though the inner Button
              is disabled (native disabled buttons swallow mouse events). */}
          <Tooltip label={RECURRING_CONDITION_DISABLED_TOOLTIP} withArrow position="top">
            {recurring.condition ? (
              <div
                className="space-y-2"
                data-testid="recurring-condition-affordance"
                data-condition-disabled="true"
                aria-disabled="true"
                aria-describedby="recurring-condition-disabled-reason"
              >
                <Button
                  size="compact-xs"
                  variant="outline"
                  color="red"
                  disabled
                  aria-disabled="true"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.preventDefault();
                    // No-op — E1b reserved (Phase 4). Submit path is unaffected.
                  }}
                >
                  条件を外す
                </Button>
                <div aria-disabled="true" className="pointer-events-none opacity-60">
                  <ConditionEditor
                    node={recurring.condition}
                    onChange={(next) => setField("recurring.condition", next)}
                    t={t}
                  />
                </div>
                <span id="recurring-condition-disabled-reason" className="sr-only">
                  {RECURRING_CONDITION_DISABLED_TOOLTIP}
                </span>
              </div>
            ) : (
              <Button
                size="xs"
                variant="outline"
                disabled
                aria-disabled="true"
                tabIndex={-1}
                data-testid="recurring-condition-affordance"
                data-condition-disabled="true"
                aria-describedby="recurring-condition-disabled-reason"
                onClick={(event) => {
                  // E1b reserved — affordance is disabled. Mantine's
                  // disabled Button already suppresses click, but we
                  // guard explicitly so test runners that simulate
                  // pointer events still cannot mutate the store.
                  event.preventDefault();
                  event.stopPropagation();
                }}
                className="cursor-not-allowed"
              >
                繰り返し条件を追加
                <span id="recurring-condition-disabled-reason" className="sr-only">
                  {RECURRING_CONDITION_DISABLED_TOOLTIP}
                </span>
              </Button>
            )}
          </Tooltip>
          </div>
        </FormRow>
      )}
      <FormRow icon={<Calendar className="h-4 w-4" aria-hidden />} className="items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t("quickCreate.repeatEndLabel")}</span>
          <EndDateToggle
            endDate={recurring.endDate}
            onChange={(next) => setField("recurring.endDate", next)}
            t={t}
          />
        </div>
      </FormRow>
    </div>
  );
}
