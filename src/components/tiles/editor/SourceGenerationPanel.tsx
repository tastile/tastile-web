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
 * directly. The orchestrator (QuickTileCreate) reads the store slice and
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

import {
  Chip,
  NumberInput,
  SegmentedControl,
  Switch,
  Text,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { Calendar, Repeat } from "lucide-react";

import { TileKind } from "@/lib/domain/v1/constants";
import { translations } from "@/lib/i18n/translations";
import type { EditorLocale } from "./date-utils";
import { SEGMENT_STYLES } from "./panel-styles";

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
}

export function SourceGenerationPanel({
  recurring,
  setField,
  locale,
  t,
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
          <BuilderLabel title={t("quickCreate.intervalLabel") ?? "Interval (min)"} />
          <NumberInput
            min={5}
            step={5}
            value={30}
            size="sm"
            suffix="min"
            styles={{ input: { backgroundColor: "var(--surface-2)" } }}
          />
        </div>
      )}
      {conditionEnabled && (
        <div className="rounded-lg border border-border bg-surface-0 p-3">
          <Text size="xs" c="var(--foreground-muted)">
            {t("quickCreate.conditionModeHint") ??
              'Activates when the condition is met. Configure conditions in the "Condition combinations" section.'}
          </Text>
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
