"use client";

import { usePathname } from "next/navigation";
import { useShellStore } from "@/lib/stores/shell-store";
import { ReferencesPanel } from "@/components/sidebar/ReferencesPanel";
import { TasksPanel } from "@/components/sidebar/TasksPanel";
import { ProjectsPanel } from "@/components/sidebar/ProjectsPanel";
import { SchedulePanel } from "@/components/sidebar/SchedulePanel";

const PANEL_ROUTES = [
  "/dashboard/references",
  "/dashboard/tasks",
  "/dashboard/projects",
  "/dashboard/schedule",
];

export function SideBar() {
  const pathname = usePathname();
  const panel = useShellStore((s) => s.panel);
  const open = useShellStore((s) => s.sideBarOpen);

  if (!open) return null;
  if (PANEL_ROUTES.includes(pathname)) return null;

  return (
    <aside
      aria-label="Side panel"
      className="w-72 shrink-0 overflow-y-auto bg-surface-1 pt-12"
    >
      {panel === "references" ? <ReferencesPanel /> : null}
      {panel === "tasks" ? <TasksPanel /> : null}
      {panel === "projects" ? <ProjectsPanel /> : null}
      {panel === "schedule" ? <SchedulePanel /> : null}
    </aside>
  );
}
