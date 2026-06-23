"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
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

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function bitmaskToWeekdays(mask: number): boolean[] {
  // Server: bit 0=Mon..bit 6=Sun. UI: 0=Mon..6=Sun.
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

export function RecurringTileConfigDialog() {
  const { t } = useTranslation();
  const { recurringDialog, closeRecurringDialog } = useDialogStore();

  const [data, setData] = useState<RecurringTileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const tileId = recurringDialog.tileId;

  const [weekdays, setWeekdays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [startHHMM, setStartHHMM] = useState({ h: 9, m: 0 });
  const [endHHMM, setEndHHMM] = useState({ h: 18, m: 0 });
  const [stepMin, setStepMin] = useState(1440);

  useEffect(() => {
    if (!tileId) return;
    let mounted = true;
    setLoading(true);

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
          }
        } else if (!res.ok) {
          console.error("Failed to load recurring config", res.error);
        }
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
      console.error("Failed to save recurring config", res.error);
    }
  };

  const toggleWeekday = (i: number) => {
    setWeekdays((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  return (
    <button
      type="button"
      aria-label="Close schedule editor"
      className="fixed inset-0 z-50 cursor-default bg-foreground/50"
      onClick={handleCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl bg-surface-elevated p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Edit Schedule</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full p-1 text-foreground-muted hover:bg-surface-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-foreground-subtle">Loading...</div>
        ) : (
          <div className="flex flex-col gap-4 mb-6">
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-foreground">
                Active days
              </legend>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleWeekday(i)}
                    aria-pressed={weekdays[i]}
                    className={
                      "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors " +
                      (weekdays[i]
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border bg-surface-0 text-foreground-muted hover:bg-surface-2")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="recurring-window-start-h"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Window start
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="recurring-window-start-h"
                    type="number"
                    min={0}
                    max={23}
                    value={startHHMM.h}
                    onChange={(e) =>
                      setStartHHMM((p) => ({
                        ...p,
                        h: Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)),
                      }))
                    }
                    className="w-16 rounded-md border border-border bg-surface-0 px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                  <span className="text-foreground-muted">:</span>
                  <input
                    aria-label="Window start minutes"
                    type="number"
                    min={0}
                    max={59}
                    value={startHHMM.m}
                    onChange={(e) =>
                      setStartHHMM((p) => ({
                        ...p,
                        m: Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)),
                      }))
                    }
                    className="w-16 rounded-md border border-border bg-surface-0 px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="recurring-window-end-h"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Window end
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="recurring-window-end-h"
                    type="number"
                    min={0}
                    max={23}
                    value={endHHMM.h}
                    onChange={(e) =>
                      setEndHHMM((p) => ({
                        ...p,
                        h: Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)),
                      }))
                    }
                    className="w-16 rounded-md border border-border bg-surface-0 px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                  <span className="text-foreground-muted">:</span>
                  <input
                    aria-label="Window end minutes"
                    type="number"
                    min={0}
                    max={59}
                    value={endHHMM.m}
                    onChange={(e) =>
                      setEndHHMM((p) => ({
                        ...p,
                        m: Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)),
                      }))
                    }
                    className="w-16 rounded-md border border-border bg-surface-0 px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="recurring-interval"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Interval (minutes)
              </label>
              <input
                id="recurring-interval"
                type="number"
                min={1}
                value={stepMin}
                onChange={(e) => setStepMin(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-md border border-border bg-surface-0 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-foreground-subtle">
                {stepMin < 60
                  ? `${stepMin} minutes`
                  : stepMin < 1440
                    ? `${Math.floor(stepMin / 60)}h ${stepMin % 60}m`
                    : `${Math.floor(stepMin / 1440)}d ${Math.floor((stepMin % 1440) / 60)}h`}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-1"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : t("common.save")}
          </button>
        </div>
      </div>
    </button>
  );
}
