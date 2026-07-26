"use client";

/**
 * AutomationPanel — Recurring v4 editor (Phase 4 #2b).
 *
 * v4 design (parity with `docs/tastile_tile_creation_panel_demo_v4.html`):
 *   - 発生 (Occurrence): 5-way choice tab (1回 / 毎日 / 毎週 / 間隔 / 条件成立時)
 *   - 曜日 (Weekday): always-visible row with bit-0 = Sunday … bit-6 = Saturday
 *     mask; when repeatMode !== "weekly" the row is shown with a "毎週の場合"
 *     hint annotation rather than hidden
 *   - 終了 (End): explicit Switch (off = "終了日なし"; on reveals a date picker).
 *     The earlier "終了日なし" card that *created* an end date on click was
 *     replaced in v3.5 because the label and click outcome disagreed.
 *
 * The legacy lifecycle / generator / window 3-tab editors and FrameRulesList
 * were removed in Phase 4 #2b per the user's "v4 full compliance" choice.
 * The underlying store fields (`recurring.life`, `recurring.frameRules`,
 * `recurrence.generator`, `recurrence.window`) remain on the v1 schema and
 * will be exposed via a separate detail-settings UI later; for now they are
 * read-only defaults.
 */

import { Button, SegmentedControl, Switch } from "@mantine/core";
import { Calendar, Repeat } from "lucide-react";

import { FormPanel } from "@/components/ui/form";
import { TileKind } from "@/lib/domain/v1/constants";
import { cn } from "@/lib/utils/cn";

import type { EditorLocale } from "./date-utils";
import { SEGMENT_STYLES } from "./panel-styles";

// Bit 0 = Sunday … bit 6 = Saturday (matches WindowEditor.weekdayMask convention
// that already exists in this repo).
const WEEKDAY_LABELS: Record<EditorLocale, readonly string[]> = {
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const REPEAT_MODE_OPTIONS = [
  { id: "once", labelKey: "repeatOnce" },
  { id: "daily", labelKey: "repeatDaily" },
  { id: "weekly", labelKey: "repeatWeekly" },
  { id: "interval", labelKey: "repeatInterval" },
  { id: "condition", labelKey: "repeatCondition" },
] as const;

interface BuilderLabelProps {
  title: string;
  hint?: string;
}

function BuilderLabel({ title, hint }: BuilderLabelProps) {
  return (
    <div className="flex items-baseline gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
      <span>{title}</span>
      {hint ? <span className="font-normal normal-case tracking-normal">{hint}</span> : null}
    </div>
  );
}

function WeekdayRow({
  mask,
  disabled,
  onToggle,
  locale,
}: {
  mask: number;
  disabled: boolean;
  onToggle: (bit: number) => void;
  locale: EditorLocale;
}) {
  return (
    <div className="flex flex-wrap gap-1" data-testid="recurring-weekday-row">
      {WEEKDAY_LABELS[locale].map((label, bit) => {
        const active = (mask & (1 << bit)) !== 0;
        return (
          <Button
            key={bit}
            type="button"
            role="switch"
            aria-checked={active}
            aria-label={label}
            data-testid={`recurring-weekday-${bit}`}
            disabled={disabled}
            onClick={() => onToggle(bit)}
            className={cn(
              "flex h-8 w-9 items-center justify-center rounded-md text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "bg-accent-soft text-accent-ink"
                : "bg-surface-1 text-foreground-muted hover:bg-surface-2 disabled:hover:bg-surface-1",
            )}
            variant="subtle"
            size="compact-sm"
          >
            {label}
          </Button>
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
  // The previous incarnation rendered an "終了日なし" button that *created*
  // an end date on click — the label promised nothing, the click did
  // something. Replace the click-to-create affordance with an explicit
  // Switch so the on/off state and the click outcome match.
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
        <input
          type="date"
          aria-label={t("quickCreate.repeatEndLabel")}
          value={endDate ? endDate.slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value)}
          className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      ) : null}
    </div>
  );
}

export interface AutomationPanelProps {
  recurring: {
    repeatMode: "once" | "daily" | "weekly" | "interval" | "condition";
    weekdayMask: number;
    endDate: string;
  };
  setField: (path: string, value: unknown) => void;
  locale: EditorLocale;
  t: (key: string) => string;
}

export function AutomationPanel({ recurring, setField, locale, t }: AutomationPanelProps) {
  const weekdayEnabled = recurring.repeatMode === "weekly";
  return (
    <FormPanel>
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
      <div className="space-y-1.5">
        <BuilderLabel
          title={t("quickCreate.repeatWeekdayLabel")}
          hint={weekdayEnabled ? undefined : t("quickCreate.repeatWeekdayHint")}
        />
        <WeekdayRow
          mask={recurring.weekdayMask}
          disabled={!weekdayEnabled}
          onToggle={(bit) => setField("recurring.weekdayMask", recurring.weekdayMask ^ (1 << bit))}
          locale={locale}
        />
      </div>
      <div className="space-y-1.5">
        <BuilderLabel title={t("quickCreate.repeatEndLabel")} />
        <EndDateToggle
          endDate={recurring.endDate}
          onChange={(next) => setField("recurring.endDate", next)}
          t={t}
        />
      </div>
    </FormPanel>
  );
}
