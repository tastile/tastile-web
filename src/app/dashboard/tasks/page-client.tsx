"use client";

import { TasksMain } from "@/features/manage-tasks/ui/TasksMain";
import { TasksSidePanel } from "@/features/manage-tasks/ui/TasksSidePanel";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { useTrackVisit } from "@/shared/hooks/use-track-visit";

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
