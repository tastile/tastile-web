"use client";

/**
 * AutomationPanel — Recurring v4 editor (Phase 4 #2b).
 *
 * v4 design (parity with `docs/tastile_tile_creation_panel_demo_v4.html`):
 *   - 発生 (Occurrence): 5-way choice tab (1回 / 毎日 / 毎週 / 間隔 / 条件成立時)
 *   - 曜日 (Weekday): always-visible row with bit-0 = Sunday … bit-6 = Saturday
 *     mask; when repeatMode !== "weekly" the row is shown with a "毎週の場合"
 *     hint annotation rather than hidden
 *   - 終了 (End): null-card "終了日なし" toggle; clicking reveals a date picker
 *
 * The legacy lifecycle / generator / window 3-tab editors and FrameRulesList
 * were removed in Phase 4 #2b per the user's "v4 full compliance" choice.
 * The underlying store fields (`recurring.life`, `recurring.frameRules`,
 * `recurrence.generator`, `recurrence.window`) remain on the v1 schema and
 * will be exposed via a separate detail-settings UI later; for now they are
 * read-only defaults.
 */

import { Calendar, Repeat } from "lucide-react";

import { FormPanel } from "@/components/ui/form";
import { cn } from "@/lib/utils/cn";

import { type EditorLocale } from "./date-utils";

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
  t,
  locale,
}: {
  mask: number;
  disabled: boolean;
  onToggle: (bit: number) => void;
  t: (key: string) => string;
  locale: EditorLocale;
}) {
  return (
    <div className="flex flex-wrap gap-1" data-testid="recurring-weekday-row">
      {WEEKDAY_LABELS[locale].map((label, bit) => {
        const active = (mask & (1 << bit)) !== 0;
        return (
          <button
            key={bit}
            type="button"
            role="switch"
            aria-checked={active}
            aria-label={label}
            data-testid={`recurring-weekday-${bit}`}
            disabled={disabled}
            onClick={() => onToggle(bit)}
            className={cn(
              "flex h-8 w-9 items-center justify-center rounded-md border text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "border-primary bg-primary text-primary-fg"
                : "border-border bg-surface-1 text-foreground-muted hover:bg-surface-2 disabled:hover:bg-surface-1",
            )}
          >
            {label}
          </button>
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
  if (endDate) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-0 p-2.5">
          <Calendar size={16} aria-hidden="true" className="text-foreground-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">
              {t("quickCreate.repeatEndSetTitle")}
            </div>
            <div className="text-[10px] text-foreground-muted">{endDate.slice(0, 10)}</div>
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("quickCreate.repeatEndRemove")}
            className="rounded-md px-2 py-1 text-[10px] font-semibold text-foreground-muted hover:bg-surface-2 hover:text-danger focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("quickCreate.repeatEndRemove")}
          </button>
        </div>
        <input
          type="date"
          aria-label={t("quickCreate.repeatEndLabel")}
          value={endDate ? endDate.slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value)}
          className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        const today = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00:00.000Z`;
        onChange(iso);
      }}
      className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-surface-0 p-3 text-left transition-colors hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="h-3 w-3 shrink-0 rounded-full border-2 border-foreground-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-foreground">
          {t("quickCreate.repeatEndNoneTitle")}
        </div>
        <div className="text-[10px] text-foreground-muted">{t("quickCreate.repeatEndNoneSub")}</div>
      </div>
    </button>
  );
}

export interface AutomationPanelProps {
  kindIsRecurring: boolean;
  recurring: {
    repeatMode: "once" | "daily" | "weekly" | "interval" | "condition";
    weekdayMask: number;
    endDate: string;
  };
  setField: (path: string, value: unknown) => void;
  locale: EditorLocale;
  t: (key: string) => string;
}

export function AutomationPanel({
  kindIsRecurring,
  recurring,
  setField,
  locale,
  t,
}: AutomationPanelProps) {
  if (!kindIsRecurring) {
    return (
      <FormPanel>
        <span className="text-xs text-foreground-muted">{t("quickCreate.phaseNotReady")}</span>
      </FormPanel>
    );
  }
  const weekdayEnabled = recurring.repeatMode === "weekly";
  return (
    <FormPanel>
      <div className="flex items-center gap-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
        <Repeat size={14} aria-hidden="true" />
        <span>{t("quickCreate.recurrenceNavTitle")}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={t("quickCreate.repeatChip")}
        className="flex flex-wrap gap-1"
        data-testid="recurring-mode-tabs"
      >
        {REPEAT_MODE_OPTIONS.map((opt) => {
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
      <div className="space-y-1.5">
        <BuilderLabel
          title={t("quickCreate.repeatWeekdayLabel")}
          hint={weekdayEnabled ? undefined : t("quickCreate.repeatWeekdayHint")}
        />
        <WeekdayRow
          mask={recurring.weekdayMask}
          disabled={!weekdayEnabled}
          onToggle={(bit) =>
            setField("recurring.weekdayMask", recurring.weekdayMask ^ (1 << bit))
          }
          t={t}
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