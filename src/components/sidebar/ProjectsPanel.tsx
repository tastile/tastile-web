"use client";

import { useProjectsStore } from "@/lib/stores/projects-store";
import { useTileList } from "@/lib/hooks/use-tile-list";

export function ProjectsPanel() {
  const { projects, create, remove } = useProjectsStore();
  const { tiles } = useTileList({ viewMode: "list", limit: 500 });
  const projectList = Object.values(projects);

  function handleCreate() {
    const name = prompt("Project name:");
    if (!name) return;
    create(name, [], "#6b7280");
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">Projects</span>
        <button
          type="button"
          onClick={handleCreate}
          className="text-[10px] text-accent hover:underline"
        >
          + New
        </button>
      </div>
      {projectList.length === 0 ? (
        <div className="px-4 py-2 text-xs text-foreground-subtle">
          No projects yet. Create one to group tiles by label.
        </div>
      ) : (
        projectList.map((p) => {
          const count = tiles.filter((t) =>
            p.labelFilter.length === 0 || t.labels.some((l) => p.labelFilter.includes(l)),
          ).length;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-surface-2"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
              <span className="font-mono text-[10px] text-foreground-subtle">{count}</span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="text-[10px] text-foreground-subtle hover:text-danger"
              >
                ✕
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
