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
 */

import { translations } from "@/shared/i18n/translations";
import { SEGMENT_STYLES } from "@/shared/ui/panel-styles";
import type { ConditionNode } from "@/tile/model/v1/condition";
import { ConditionKind, TileKind } from "@/tile/model/v1/constants";
import { Button, Chip, NumberInput, SegmentedControl, Switch } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { Calendar, Repeat } from "lucide-react";
import { ConditionEditor } from "./ConditionEditor";
import type { EditorLocale } from "./date-utils";
import { defaultTerm } from "./default-term";

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
  de: enTree.weekdays,
  es: enTree.weekdays,
  "pt-BR": enTree.weekdays,
  fr: enTree.weekdays,
  ko: enTree.weekdays,
  "zh-CN": enTree.weekdays,
};

const REPEAT_MODE_OPTIONS = [
  { id: "once", labelKey: "repeatOnce" },
  { id: "daily", labelKey: "repeatDaily" },
  { id: "weekly", labelKey: "repeatWeekly" },
  { id: "interval", labelKey: "repeatInterval" },
  { id: "condition", labelKey: "repeatCondition" },
] as const;

type RepeatMode = (typeof REPEAT_MODE_OPTIONS)[number]["id"];

function BuilderLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
      <span>{title}</span>
      {hint ? <span className="font-normal normal-case tracking-normal">{hint}</span> : null}
    </div>
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
  /** 現在の timeOfDay 設定（interval モード時の連携表示用） */
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
      <div className="flex items-center gap-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
        <Repeat size={14} aria-hidden="true" />
        <span>{t("quickCreate.recurrenceNavTitle")}</span>
      </div>
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
        <div className="space-y-1.5">
          <BuilderLabel title={t("quickCreate.repeatWeekdayLabel")} />
          <WeekdayRow
            mask={recurring.weekdayMask}
            onToggle={(bit) =>
              setField("recurring.weekdayMask", recurring.weekdayMask ^ (1 << bit))
            }
            locale={locale}
          />
        </div>
      )}
      {intervalEnabled && (
        <div className="space-y-1.5">
          <BuilderLabel title={t("quickCreate.intervalLabel") ?? "Interval"} />
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
      )}
      {conditionEnabled && (
        <div className="space-y-2 rounded-lg border border-border bg-surface-0 p-3">
          <BuilderLabel
            title={t("quickCreate.conditionModeLabel") ?? "繰り返し条件"}
            hint={t("quickCreate.conditionModeHint") ?? "条件が真のときだけTileを生成します"}
          />
          {recurring.condition ? (
            <div className="space-y-2">
              <Button
                size="compact-xs"
                variant="outline"
                color="red"
                onClick={() => setField("recurring.condition", null)}
              >
                条件を外す
              </Button>
              <ConditionEditor
                node={recurring.condition}
                onChange={(next) => setField("recurring.condition", next)}
                t={t}
              />
            </div>
          ) : (
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                setField("recurring.condition", {
                  kind: ConditionKind.TERM,
                  children: [],
                  term: defaultTerm("calendar"),
                })
              }
            >
              繰り返し条件を追加
            </Button>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <BuilderLabel title={t("quickCreate.repeatEndLabel")} />
        <EndDateToggle
          endDate={recurring.endDate}
          onChange={(next) => setField("recurring.endDate", next)}
          t={t}
        />
      </div>
    </div>
  );
}
