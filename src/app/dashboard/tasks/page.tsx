"use client";

import { TasksPanel } from "@/components/sidebar/TasksPanel";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

export default function TasksPage() {
  useTrackVisit("/dashboard/tasks");
  return (
    <div className="h-full overflow-y-auto">
      <TasksPanel />
    </div>
  );
}
