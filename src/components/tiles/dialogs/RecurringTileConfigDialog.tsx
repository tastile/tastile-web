"use client";

import { Loader2, Repeat, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormPanel, RowInput, RowSegmented } from "@/components/ui/form";
import { getCoreClient } from "@/lib/api/endpoints";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDialogStore } from "@/lib/stores/dialog-store";

interface RecurringTileData {
  recurrence: {
    generator:
      | { kind: "time_based"; step_min: number; anchor_epoch_min: number | null }
      | { kind: "focus_block_based"; phases: Array<{ focus_min: number; break_min: number }> };
    window: {
      weekday_mask: number;
      start_offset_min: number;
      end_offset_min: number;
      exclusions: Array<{ start_offset_min: number; end_offset_min: number }>;
    };
    selector: {
      expression: unknown | null;
    };
  };
}

const WEEKDAY_LABELS_JA = ["月", "火", "水", "木", "金", "土", "日"];
const WEEKDAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function bitmaskToWeekdays(mask: number): boolean[] {
  const result = [false, false, false, false, false, false, false];
  for (let i = 0; i < 7; i++) {
    result[i] = (mask & (1 << i)) !== 0;
  }
  return result;
}

function weekdaysToBitmask(days: boolean[]): number {
  let mask = 0;
  for (let i = 0; i < 7; i++) {
    if (days[i]) mask |= 1 << i;
  }
  return mask;
}

function minutesToHHMM(min: number): { h: number; m: number } {
  return { h: Math.floor(min / 60), m: min % 60 };
}

function hhmmToMinutes(h: number, m: number): number {
  return Math.max(0, Math.min(1440, h * 60 + m));
}

function formatHHMM(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseHHMM(raw: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(raw.trim());
  if (!match) return null;
  const h = Number.parseInt(match[1] ?? "", 10);
  const m = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function describeInterval(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

export function RecurringTileConfigDialog() {
  const { t, locale } = useTranslation();
  const { recurringDialog, closeRecurringDialog } = useDialogStore();

  const [data, setData] = useState<RecurringTileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tileId = recurringDialog.tileId;

  const [weekdays, setWeekdays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [startHHMM, setStartHHMM] = useState<{ h: number; m: number }>({ h: 9, m: 0 });
  const [endHHMM, setEndHHMM] = useState<{ h: number; m: number }>({ h: 18, m: 0 });
  const [stepMin, setStepMin] = useState(1440);
  const [stepInput, setStepInput] = useState("1440");

  useEffect(() => {
    if (!tileId) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    getCoreClient()
      .call<RecurringTileData>("getRecurringTile", { pathParams: { id: tileId } })
      .then((res) => {
        if (!mounted) return;
        setLoading(false);
        if (res.ok && res.data) {
          setData(res.data);
          const win = res.data.recurrence.window;
          setWeekdays(bitmaskToWeekdays(win.weekday_mask));
          setStartHHMM(minutesToHHMM(win.start_offset_min));
          setEndHHMM(minutesToHHMM(win.end_offset_min));
          const gen = res.data.recurrence.generator;
          if (gen.kind === "time_based") {
            setStepMin(gen.step_min);
            setStepInput(String(gen.step_min));
          } else {
            const total = gen.phases.reduce((acc, p) => acc + p.focus_min + p.break_min, 0);
            if (total > 0) {
              setStepMin(total);
              setStepInput(String(total));
            }
          }
        } else if (!res.ok) {
          setError(res.error.message);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : "Unknown error");
      });

    return () => {
      mounted = false;
    };
  }, [tileId]);

  if (!recurringDialog.open || !tileId) return null;

  const handleCancel = () => closeRecurringDialog();

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);

    const gen = data.recurrence.generator;
    const payload = {
      generator:
        gen.kind === "time_based"
          ? {
              kind: "time_based" as const,
              step_min: stepMin,
              anchor_epoch_min: gen.anchor_epoch_min,
            }
          : { kind: "focus_block_based" as const, phases: gen.phases },
      window: {
        weekday_mask: weekdaysToBitmask(weekdays),
        start_offset_min: hhmmToMinutes(startHHMM.h, startHHMM.m),
        end_offset_min: hhmmToMinutes(endHHMM.h, endHHMM.m),
        exclusions: data.recurrence.window.exclusions,
      },
      selector: data.recurrence.selector,
    };

    const res = await getCoreClient().call("putRecurringTile", {
      pathParams: { id: tileId },
      body: payload,
    });

    setSaving(false);
    if (res.ok) {
      closeRecurringDialog();
      window.dispatchEvent(new Event("tastile:refresh-tiles"));
    } else {
      setError(res.error.message);
    }
  };

  const toggleWeekday = (i: number) => {
    setWeekdays((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const startStr = formatHHMM(startHHMM.h, startHHMM.m);
  const endStr = formatHHMM(endHHMM.h, endHHMM.m);
  const weekdayLabels = locale === "ja" ? WEEKDAY_LABELS_JA : WEEKDAY_LABELS_EN;
  const focusedWeekdayValue = (() => {
    const idx = weekdays.findIndex((v) => v);
    return idx >= 0 ? String(idx) : "0";
  })();

  return (
    <>
      <button
        type="button"
        aria-label={t("common.cancel")}
        className="fixed inset-0 z-50 cursor-default bg-foreground/30 backdrop-blur-[0.5px]"
        onClick={handleCancel}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("quickCreate.recurrenceNavTitle")}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l border-border bg-surface-1 shadow-lg"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">
              {t("quickCreate.recurrenceNavTitle")}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t("common.cancel")}
            onClick={handleCancel}
            className="rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {error ? (
          <div
            role="alert"
            className="border-b border-border bg-danger/10 px-4 py-2 text-xs text-danger"
          >
            {error}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto">
          <FormPanel>
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-foreground-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Loading...</span>
              </div>
            ) : (
              <>
                <RowSegmented
                  icon={Repeat}
                  options={weekdayLabels.map((label, i) => ({ value: String(i), label }))}
                  value={focusedWeekdayValue}
                  onChange={() => {
                    /* visual only — toggle via the day chips below */
                  }}
                />

                <div className="-mt-1 ml-[32px] flex flex-wrap items-center gap-1.5">
                  {weekdayLabels.map((label, i) => {
                    const active = weekdays[i] ?? false;
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: custom button-styled weekday chip requires role="checkbox" on a button for visual flexibility
                      <button
                        key={label}
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        aria-label={label}
                        onClick={() => toggleWeekday(i)}
                        className={
                          (active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-surface-1 text-foreground-muted hover:bg-surface-2") +
                          " rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <RowInput
                  icon={Loader2}
                  type="time"
                  placeholder={t("quickCreate.windowStartAt")}
                  value={startStr}
                  onChange={(v) => {
                    const parsed = parseHHMM(v);
                    if (parsed) setStartHHMM(parsed);
                  }}
                  ariaLabel={t("quickCreate.windowStartAt")}
                />

                <RowInput
                  icon={Loader2}
                  type="time"
                  placeholder={t("quickCreate.windowEndAt")}
                  value={endStr}
                  onChange={(v) => {
                    const parsed = parseHHMM(v);
                    if (parsed) setEndHHMM(parsed);
                  }}
                  ariaLabel={t("quickCreate.windowEndAt")}
                />

                <RowInput
                  icon={Repeat}
                  type="text"
                  placeholder={t("quickCreate.recurrenceInterval")}
                  value={stepInput}
                  onChange={(v) => {
                    const sanitized = v.replace(/[^0-9]/g, "");
                    setStepInput(sanitized);
                    const n = Number.parseInt(sanitized, 10);
                    if (Number.isFinite(n) && n > 0) {
                      setStepMin(n);
                    }
                  }}
                  ariaLabel={t("quickCreate.recurrenceInterval")}
                  trailing={
                    <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-subtle tabular-nums">
                      {describeInterval(stepMin)}
                    </span>
                  }
                />
              </>
            )}
          </FormPanel>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md px-3 py-1.5 text-xs text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving || !data}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg hover:bg-primary-hover focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving..." : t("common.save")}
          </button>
        </footer>
      </aside>
    </>
  );
}
