"use client";

import { TasksSidePanel } from "@/components/panels/TasksSidePanel";
import { TasksMain } from "@/components/tasks/TasksMain";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

const TASKS_SIDE_PANEL = <TasksSidePanel />;

export function TasksPageClient() {
  useTrackVisit("/dashboard/tasks");
  useSidePanel(TASKS_SIDE_PANEL);

  return (
    <div className="h-full overflow-y-auto">
      <TasksMain />
    </div>
  );
}
