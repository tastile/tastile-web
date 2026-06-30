"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { createWorkspace, deleteWorkspace, useProjects } from "@/lib/hooks/use-projects";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

export function ProjectsSidePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { workspaces, refresh, loading, error } = useProjects();

  const currentOwner = searchParams.get("owner") ?? null;

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingBusy, setCreatingBusy] = useState(false);

  function handleSelect(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("owner", id);
    else params.delete("owner");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function resetForm() {
    setName("");
    setSlug("");
    setColor("#6b7280");
    setCreateError(null);
    setCreating(false);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setCreateError("name required");
      return;
    }
    setCreatingBusy(true);
    setCreateError(null);
    try {
      const ws = await createWorkspace({
        display_name: name.trim(),
        slug: slug.trim() || null,
        color,
      });
      await refresh();
      handleSelect(ws.id);
      resetForm();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreatingBusy(false);
    }
  }

  async function handleDelete(id: string, displayName: string) {
    if (typeof window !== "undefined" && !window.confirm(`Delete project "${displayName}"?`)) return;
    try {
      await deleteWorkspace(id);
      await refresh();
      if (currentOwner === id) handleSelect(null);
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert(`Failed to delete: ${(e as Error).message}`);
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex items-center justify-between px-4 pb-1 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Projects
        </span>
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-[10px] text-accent hover:underline"
            data-testid="project-create"
          >
            + New
          </button>
        ) : null}
      </div>

      {creating ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
          className="flex flex-col gap-1.5 border-t border-border/40 px-2 py-2"
        >
          <Input
            autoFocus
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            data-testid="project-create-name"
          />
          <div className="flex items-center gap-2">
            <Input
              placeholder="slug (optional)"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              pattern="[a-z0-9-]+"
              maxLength={40}
              data-testid="project-create-slug"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Project color"
              className="h-8 w-12 cursor-pointer rounded border border-border"
              data-testid="project-create-color"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="submit"
              size="small"
              disabled={creatingBusy || !name.trim()}
              data-testid="project-create-submit"
            >
              {creatingBusy ? "Creating..." : "Create"}
            </Button>
            <Button
              type="button"
              size="small"
              variant="ghost"
              onClick={resetForm}
              disabled={creatingBusy}
            >
              Cancel
            </Button>
            {createError && (
              <span className="text-[10px] text-status-danger">{createError}</span>
            )}
          </div>
        </form>
      ) : null}

      <div className="px-2">
        <div className="flex flex-col space-y-0.5">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              currentOwner === null
                ? "bg-surface-elevated font-medium text-foreground"
                : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-border" />
            <span className="min-w-0 flex-1 truncate">All Projects</span>
          </button>

          {loading && <div className="px-2 py-1.5 text-[10px] text-foreground-subtle">Loading…</div>}
          {error && (
            <div className="px-2 py-1.5 text-[10px] text-status-danger">{error.message}</div>
          )}

          {workspaces.map((w) => (
            <div key={w.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSelect(w.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  currentOwner === w.id
                    ? "bg-surface-elevated font-medium text-foreground"
                    : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
                )}
                data-testid={`project-select-${w.id}`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: w.color ?? "#6b7280" }}
                />
                <span className="min-w-0 flex-1 truncate">{w.display_name}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(w.id, w.display_name)}
                aria-label={`Delete ${w.display_name}`}
                className="invisible px-1.5 py-1 text-foreground-subtle hover:text-status-danger group-hover:visible"
                data-testid={`project-delete-${w.id}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
