"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface TileEditPanelInnerProps {
  mode: "create" | "edit";
  initialTitle: string;
  initialStartAt: string;
  initialEndAt: string;
  onClose: () => void;
  onSave: (data: { title: string; startAt: string; endAt: string; labels: string[] }) => void;
}

function TileEditPanelInner({
  mode,
  initialTitle,
  initialStartAt,
  initialEndAt,
  onClose,
  onSave,
}: TileEditPanelInnerProps) {
  const [title, setTitle] = useState(initialTitle);
  const [startAt, setStartAt] = useState(initialStartAt);
  const [endAt, setEndAt] = useState(initialEndAt);
  const [labels, setLabels] = useState<string[]>([]);

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-foreground/5 backdrop-blur-[0.5px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[56] w-96 overflow-y-auto bg-surface-1 shadow-lg">
        <div className="flex items-center justify-between border-b border-surface-2 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            {mode === "create" ? "New tile" : "Edit tile"}
          </h3>
          <button
            type="button"
            onClick={onClose}
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
        </div>

        <div className="flex items-center justify-between border-t border-surface-2 px-4 py-3">
          {mode === "edit" ? (
            <button
              type="button"
              className="rounded px-3 py-1.5 text-xs text-danger hover:bg-surface-2"
            >
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs text-foreground-subtle hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ title, startAt, endAt, labels })}
              disabled={!title.trim()}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-40"
            >
              Save ⏎
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface TileEditPanelProps {
  open: boolean;
  mode: "create" | "edit";
  initialTitle?: string;
  initialStartAt?: string;
  initialEndAt?: string;
  onClose: () => void;
  onSave: (data: { title: string; startAt: string; endAt: string; labels: string[] }) => void;
}

export function TileEditPanel({
  open,
  mode,
  initialTitle = "",
  initialStartAt = "",
  initialEndAt = "",
  onClose,
  onSave,
}: TileEditPanelProps) {
  if (!open) return null;
  return (
    <TileEditPanelInner
      key={`tile-edit-${initialTitle}-${initialStartAt}`}
      mode={mode}
      initialTitle={initialTitle}
      initialStartAt={initialStartAt}
      initialEndAt={initialEndAt}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
