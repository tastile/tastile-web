"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import { cn } from "@/lib/utils/cn";

const SCHEDULE_VIEWS = [
  { id: "recurring", label: "Recurring Tiles" },
  { id: "upcoming", label: "Upcoming Deadlines" },
];

export function ScheduleSidePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentView = searchParams.get("view") ?? "recurring";

  function handleSelect(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", id);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-6 pt-2 select-none">
      <div className="px-4 pb-1 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
          Schedule Views
        </span>
      </div>

      <div className="px-2">
        <div className="flex flex-col space-y-0.5">
          {SCHEDULE_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSelect(v.id)}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                currentView === v.id
                  ? "bg-surface-elevated font-medium text-foreground"
                  : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <ProjectsCheckboxSection />
    </div>
  );
}

function ProjectsCheckboxSection() {
  const { workspaces, loading } = useProjects();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const allIds = useMemo(() => workspaces.map((w) => w.id), [workspaces]);
  const selected = useMemo(() => {
    const raw = searchParams.get("projects");
    if (!raw) return new Set(allIds);
    return new Set(raw.split(",").filter(Boolean));
  }, [searchParams, allIds]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const params = new URLSearchParams(searchParams.toString());
    if (next.size === allIds.length) params.delete("projects");
    else params.set("projects", [...next].join(","));
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  if (loading) {
    return <div className="px-3 text-[10px] text-foreground-subtle">Loading projects…</div>;
  }
  if (workspaces.length === 0) return null;

  return (
    <div className="border-t border-border/40 px-3 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
          Projects
        </p>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {selected.size}/{workspaces.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {workspaces.map((w) => (
          <label
            key={w.id}
            className="flex cursor-pointer items-center gap-2 text-xs text-foreground-subtle hover:text-foreground"
          >
            <input
              type="checkbox"
              checked={selected.has(w.id)}
              onChange={() => toggle(w.id)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
              data-testid={`schedule-project-${w.id}`}
            />
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: w.color ?? "#6b7280" }}
            />
            <span className="min-w-0 flex-1 truncate">{w.display_name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
