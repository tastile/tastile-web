"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDialogStore } from "@/lib/stores/dialog-store";

interface RecurringTileData {
  recurrence: {
    generator: {
      focus_block_based?: { phases: unknown[] };
      step_min: number;
    };
    window: {
      weekday_mask: number;
      start_offset_min: number;
      end_offset_min: number;
    };
    selector: {
      expression: string | null;
    };
  };
}

export function RecurringTileConfigDialog() {
  const { t } = useTranslation();
  const { recurringDialog, closeRecurringDialog } = useDialogStore();
  
  const [data, setData] = useState<RecurringTileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const tileId = recurringDialog.tileId;

  // Form states
  const [stepMin, setStepMin] = useState(1440);
  const [startOffsetMin, setStartOffsetMin] = useState(0);
  const [endOffsetMin, setEndOffsetMin] = useState(1440);
  const [expression, setExpression] = useState("");

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
          setStepMin(res.data.recurrence.generator.step_min);
          setStartOffsetMin(res.data.recurrence.window.start_offset_min);
          setEndOffsetMin(res.data.recurrence.window.end_offset_min);
          setExpression(res.data.recurrence.selector.expression || "");
        } else if (!res.ok) {
          console.error("Failed to load recurring config", res.error);
        }
      });

    return () => {
      mounted = false;
    };
  }, [tileId]);

  if (!recurringDialog.open || !tileId) return null;

  const handleCancel = () => {
    closeRecurringDialog();
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    
    const payload = {
      ...data.recurrence,
      generator: {
        ...data.recurrence.generator,
        step_min: stepMin,
      },
      window: {
        ...data.recurrence.window,
        start_offset_min: startOffsetMin,
        end_offset_min: endOffsetMin,
      },
      selector: {
        ...data.recurrence.selector,
        expression: expression || null,
      },
    };

    const res = await getCoreClient().call("putRecurringTile", {
      pathParams: { id: tileId },
      body: payload,
    });

    setSaving(false);
    if (res.ok) {
      closeRecurringDialog();
      // Optional: trigger re-fetch of tiles
      window.dispatchEvent(new Event("tastile:refresh-tiles"));
    } else {
      console.error("Failed to save recurring config", res.error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface-elevated p-6"
        onClick={(e) => e.stopPropagation()}
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
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Interval (minutes)
              </label>
              <input
                type="number"
                value={stepMin}
                onChange={(e) => setStepMin(parseInt(e.target.value) || 0)}
                className="w-full rounded-md border border-border bg-surface-0 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Window Start (offset)
                </label>
                <input
                  type="number"
                  value={startOffsetMin}
                  onChange={(e) => setStartOffsetMin(parseInt(e.target.value) || 0)}
                  className="w-full rounded-md border border-border bg-surface-0 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Window End (offset)
                </label>
                <input
                  type="number"
                  value={endOffsetMin}
                  onChange={(e) => setEndOffsetMin(parseInt(e.target.value) || 0)}
                  className="w-full rounded-md border border-border bg-surface-0 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Cron Expression (optional)
              </label>
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="e.g. 0 8 * * 1-5"
                className="w-full rounded-md border border-border bg-surface-0 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
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
    </div>
  );
}
