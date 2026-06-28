"use client";

import { Calendar, FileText, FolderOpen, Loader2, Tag, X } from "lucide-react";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { makeClient } from "@/lib/api/v1/submit";
import {
  archiveTileCommand,
  createTileCommand,
  updateTileCommand,
} from "@/lib/api/v1/tile-commands";
import { useTileEditStore } from "@/lib/stores/tile-edit-store";

function toIsoDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Format as YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      const client = makeClient();

      if (mode === "create") {
        const res = await createTileCommand({
          client,
          title,
        });
        if (!res.ok) {
          setError(res.error.message);
          setSaving(false);
          return;
        }
      } else {
        if (!draft?.tileId) {
          setError("tile id is missing");
          setSaving(false);
          return;
        }
        const res = await updateTileCommand({
          client,
          tileId: draft.tileId,
          title,
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

    window.dispatchEvent(new CustomEvent("tastile:tiles-changed"));
    close();
  }, [title, mode, draft, close]);

  const handleDelete = useCallback(async () => {
    if (!draft?.tileId || mode !== "edit") return;
    setSaving(true);
    setError(null);
    try {
      const res = await archiveTileCommand({
        client: makeClient(),
        tileId: draft.tileId,
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
    window.dispatchEvent(new CustomEvent("tastile:tiles-changed"));
    close();
  }, [draft, mode, close]);

  return (
    <>
      <button
        type="button"
        aria-label="Close tile editor"
        className="fixed inset-0 z-[55] cursor-default bg-foreground/5 backdrop-blur-[0.5px]"
        onClick={close}
      />
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
          <PanelSection icon={<FileText className="h-4 w-4" />} title="Identity" />
          <div>
            <label
              htmlFor="tile-edit-title"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle"
            >
              Title
            </label>
            <input
              id="tile-edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-md bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <PanelSection icon={<Calendar className="h-4 w-4" />} title="Time" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tile-edit-start"
                className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle"
              >
                Start
              </label>
              <input
                id="tile-edit-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="themed-datetime-input w-full rounded-md bg-surface-2 px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="tile-edit-end"
                className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle"
              >
                End
              </label>
              <input
                id="tile-edit-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="themed-datetime-input w-full rounded-md bg-surface-2 px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>
          </div>

          <PanelSection icon={<FolderOpen className="h-4 w-4" />} title="Meta" />
          <div>
            <label
              htmlFor="tile-edit-labels"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle"
            >
              Labels
            </label>
            <input
              id="tile-edit-labels"
              type="text"
              placeholder="Comma-separated labels"
              value={labels.join(", ")}
              onChange={(e) =>
                setLabels(
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              className="w-full rounded-md bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle outline-none"
            />
          </div>

          <PanelSection icon={<Tag className="h-4 w-4" />} title="Details" />
          <div className="rounded-md border border-border bg-surface-0 px-3 py-2 text-xs text-foreground-subtle">
            {mode === "edit"
              ? "This panel edits the same identity, time, and meta fields used at creation."
              : "Defaults are ready; title is the only required field."}
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

function PanelSection({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
      {icon}
      <span>{title}</span>
    </div>
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
