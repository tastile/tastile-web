"use client";

import type { RenderTreeNodePayload, TreeNodeData } from "@mantine/core";
import { getTreeExpandedState, Select, Tree, useTree } from "@mantine/core";
import { ChevronRight, FolderPlus, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createWorkspace,
  deleteWorkspace,
  orderWorkspaceTree,
  useProjects,
  type Workspace,
} from "@/lib/hooks/use-projects";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";

export function ProjectsSidePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { t } = useTranslation();
  const { workspaces, refresh, loading, error } = useProjects();

  const currentOwner = searchParams.get("owner") ?? null;

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [parentId, setParentId] = useState<string | null>(null);
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
    setParentId(null);
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
        parent_subject_id: parentId,
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
    if (typeof window !== "undefined" && !window.confirm(`Delete project "${displayName}"?`))
      return;
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
          {t("panels.projects.projects")}
        </span>
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted hover:bg-surface-1 hover:text-foreground"
            data-testid="project-create"
          >
            <Plus className="h-3 w-3" aria-hidden />
            New
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
          <Select
            aria-label="Parent project"
            label={
              <span className="flex items-center gap-1 text-[10px] text-foreground-subtle">
                <FolderPlus className="h-3 w-3" aria-hidden />
                Parent project
              </span>
            }
            value={parentId ?? null}
            onChange={(value) => setParentId(value || null)}
            data={[
              { value: "", label: "Top level" },
              ...orderWorkspaceTree(workspaces).map(({ workspace, depth }) => ({
                value: workspace.id,
                label: `${"　".repeat(depth)}${workspace.display_name}`,
              })),
            ]}
            size="xs"
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
            data-testid="project-create-parent"
          />
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
            {createError && <span className="text-[10px] text-status-danger">{createError}</span>}
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
            <span className="min-w-0 flex-1 truncate">{t("panels.projects.allProjects")}</span>
          </button>

          {loading && (
            <div className="px-2 py-1.5 text-[10px] text-foreground-subtle">
              {t("panels.projects.loadingProjects")}
            </div>
          )}
          {error && (
            <div className="px-2 py-1.5 text-[10px] text-status-danger">{error.message}</div>
          )}

          {!loading && !error && workspaces.length > 0 && (
            <ProjectsTree
              workspaces={workspaces}
              currentOwner={currentOwner}
              onSelect={handleSelect}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Projects tree — single-select Mantine Tree for owner filtering.
// "All Projects" lives outside (mutually exclusive with owner=<id>).
// URL ?owner=<id> is the single source of truth; the tree drives
// selection but doesn't own it. Each node also has a hover-revealed
// × delete button so we don't lose existing affordances.
// ─────────────────────────────────────────────

interface ProjectsTreeProps {
  workspaces: Workspace[];
  currentOwner: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string, displayName: string) => void;
}

function ProjectsTree({ workspaces, currentOwner, onSelect, onDelete }: ProjectsTreeProps) {
  const treeData = useMemo(() => buildProjectTree(workspaces), [workspaces]);
  const colorById = useMemo(
    () => new Map(workspaces.map((w) => [w.id, w.color] as const)),
    [workspaces],
  );
  const tree = useTree({ initialExpandedState: getTreeExpandedState(treeData, "*") });

  const renderNode = useCallback(
    ({ node, expanded, hasChildren, elementProps }: RenderTreeNodePayload) => {
      const color = colorById.get(node.value) ?? undefined;
      const isSelected = currentOwner === node.value;
      const displayName = String(node.label ?? "");
      return (
        <div
          {...elementProps}
          className={cn(
            "group flex items-center gap-1 rounded-md transition-colors",
            isSelected
              ? "bg-surface-elevated font-medium text-foreground"
              : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
          )}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={expanded ? "Collapse" : "Expand"}
              onClick={() => tree.toggleExpanded(node.value)}
              className="flex h-4 w-4 shrink-0 items-center justify-center text-foreground-lighter hover:text-foreground"
            >
              <ChevronRight
                size={12}
                aria-hidden
                className={cn("transition-transform", expanded && "rotate-90")}
              />
            </button>
          ) : (
            <span aria-hidden className="h-4 w-4 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => onSelect(node.value)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            data-testid={`project-select-${node.value}`}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color ?? "#6b7280" }}
            />
            <span className="min-w-0 flex-1 truncate">{displayName}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.value, displayName);
            }}
            aria-label={`Delete ${displayName}`}
            className="invisible px-1.5 py-1 text-foreground-subtle hover:text-status-danger group-hover:visible"
            data-testid={`project-delete-${node.value}`}
          >
            ×
          </button>
        </div>
      );
    },
    [tree, colorById, currentOwner, onSelect, onDelete],
  );

  return (
    <Tree
      data={treeData}
      tree={tree}
      levelOffset={20}
      expandOnClick={false}
      renderNode={renderNode}
    />
  );
}

/** Nested TreeNodeData built from the flat workspace list via parent links. */
function buildProjectTree(workspaces: Workspace[]): TreeNodeData[] {
  const byParent = new Map<string | null, Workspace[]>();
  const ids = new Set(workspaces.map((w) => w.id));
  for (const w of workspaces) {
    const parent = w.parent_subject_id && ids.has(w.parent_subject_id) ? w.parent_subject_id : null;
    const arr = byParent.get(parent) ?? [];
    arr.push(w);
    byParent.set(parent, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.display_name.localeCompare(b.display_name, "ja"));
  }
  const build = (parent: string | null): TreeNodeData[] =>
    (byParent.get(parent) ?? []).map((w) => ({
      value: w.id,
      label: w.display_name,
      children: build(w.id),
    }));
  return build(null);
}
