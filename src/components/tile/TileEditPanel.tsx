"use client";

import { useCallback, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { getCoreClient } from "@/lib/api/endpoints";
import { useTileEditStore } from "@/lib/stores/tile-edit-store";

function toIsoDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Format as YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoString(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  return new Date(datetimeLocal).toISOString();
}

function TileEditPanelInner() {
  const { draft, close } = useTileEditStore();
  const [title, setTitle] = useState(() => draft?.title ?? "");
  const [startAt, setStartAt] = useState(() => toIsoDatetimeLocal(draft?.startAt ?? ""));
  const [endAt, setEndAt] = useState(() => toIsoDatetimeLocal(draft?.endAt ?? ""));
  const [labels, setLabels] = useState<string[]>(() => draft?.labels ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = draft?.mode ?? "create";

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const client = getCoreClient();

      if (mode === "create") {
        const res = await client.call<{ ok: boolean; tile_id?: string }>("createTile", {
          body: {
            title: title.trim(),
            temporal: {
              fixed_start: toIsoString(startAt) || null,
              fixed_end: toIsoString(endAt) || null,
            },
            annotation: {
              semantic_role: "work",
              labels,
              timed_labels: [],
              generated_by_recalc: false,
            },
            objective: {
              objective_mode: "finish_once",
              target_work_min: null,
              target_rest_min: null,
              done_rule: "manual",
              recurrence: null,
            },
            interruption: {
              interrupt_penalty: 5,
              resume_penalty: 1,
              break_splits_work: true,
              external_interrupt_only: false,
            },
            automation: {
              prompt_on_start: false,
              prompt_on_end: false,
              auto_start_allowed: false,
              auto_end_allowed: false,
            },
            conflict_resolution: "manual_adjust",
          },
        });
        if (!res.ok) {
          setError(res.error.message);
          setSaving(false);
          return;
        }
      } else {
        // edit mode
        const res = await client.call<{ ok: boolean }>("updateTile", {
          body: {
            tile_id: draft?.tileId,
            title: title.trim(),
            temporal: {
              fixed_start: toIsoString(startAt) || null,
              fixed_end: toIsoString(endAt) || null,
            },
            annotation: {
              semantic_role: "work",
              labels,
              timed_labels: [],
              generated_by_recalc: false,
            },
            objective: {
              objective_mode: "finish_once",
              target_work_min: null,
              target_rest_min: null,
              done_rule: null,
              recurrence: null,
            },
          },
        });
        if (!res.ok) {
          setError(res.error.message);
          setSaving(false);
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
      return;
    }

    close();
  }, [title, startAt, endAt, labels, mode, draft, close]);

  const handleDelete = useCallback(async () => {
    if (!draft?.tileId || mode !== "edit") return;
    setSaving(true);
    setError(null);
    try {
      const res = await getCoreClient().call<{ ok: boolean }>("deleteTile", {
        body: { tile_id: draft.tileId },
      });
      if (!res.ok) {
        setError(res.error.message);
        setSaving(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
      return;
    }
    close();
  }, [draft, mode, close]);

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-foreground/5 backdrop-blur-[0.5px]" onClick={close} />
      <div className="fixed inset-y-0 right-0 z-[56] w-96 overflow-y-auto bg-surface-1 shadow-lg">
        <div className="flex items-center justify-between border-b border-surface-2 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            {mode === "create" ? "New tile" : "Edit tile"}
          </h3>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              className="w-full rounded-md bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                Start
              </label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="themed-datetime-input w-full rounded-md bg-surface-2 px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                End
              </label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="themed-datetime-input w-full rounded-md bg-surface-2 px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
              Labels
            </label>
            <input
              type="text"
              placeholder="Comma-separated labels"
              value={labels.join(", ")}
              onChange={(e) => setLabels(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              className="w-full rounded-md bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle outline-none"
            />
          </div>

          <div className="rounded-lg bg-surface-2 p-3 text-[10px] text-foreground-subtle">
            ▸ Repeat — coming soon
          </div>
          <div className="rounded-lg bg-surface-2 p-3 text-[10px] text-foreground-subtle">
            ▸ Conditions — coming soon
          </div>
          <div className="rounded-lg bg-surface-2 p-3 text-[10px] text-foreground-subtle">
            ▸ Notes — coming soon
          </div>

          {error && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-surface-2 px-4 py-3">
          {mode === "edit" ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="rounded px-3 py-1.5 text-xs text-danger hover:bg-surface-2 disabled:opacity-40"
            >
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded px-3 py-1.5 text-xs text-foreground-subtle hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save ⏎
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function TileEditPanel() {
  const open = useTileEditStore((s) => s.open);
  const draft = useTileEditStore((s) => s.draft);
  if (!open) return null;
  return <TileEditPanelInner key={tileEditDraftKey(draft)} />;
}

function tileEditDraftKey(draft: ReturnType<typeof useTileEditStore.getState>["draft"]): string {
  if (!draft) return "tile-edit-empty";
  return [
    "tile-edit",
    draft.mode,
    draft.tileId ?? "new",
    draft.title,
    draft.startAt,
    draft.endAt,
    draft.labels.join(","),
  ].join(":");
}
