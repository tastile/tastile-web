"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useProjectsStore } from "@/lib/stores/projects-store";
import { cn } from "@/lib/utils/cn";

export function ProjectsSidePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const { projects, create } = useProjectsStore();
  const projectList = Object.values(projects);

  const currentProject = searchParams.get("project") ?? null;

  function handleCreate() {
    const name = prompt("Project name:");
    if (!name) return;
    const labelsStr = prompt("Enter comma-separated labels to filter by (e.g. 'work,important'):");
    const labels = labelsStr ? labelsStr.split(",").map(l => l.trim()) : [];
    create(name, labels, "#6b7280");
  }

  function handleSelect(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("project", id);
    else params.delete("project");

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">Projects</span>
        <button
          type="button"
          onClick={handleCreate}
          className="text-[10px] text-accent hover:underline"
        >
          + New
        </button>
      </div>

      <div className="px-2">
        <div className="flex flex-col space-y-0.5">
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              currentProject === null
                ? "bg-surface-elevated font-medium text-foreground"
                : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-border"
            />
            <span className="min-w-0 flex-1 truncate">All Projects</span>
          </button>
          
          {projectList.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                currentProject === p.id
                  ? "bg-surface-elevated font-medium text-foreground"
                  : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
