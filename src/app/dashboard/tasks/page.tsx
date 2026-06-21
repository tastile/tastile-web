"use client";

import { Suspense } from "react";
import { TasksPanel } from "@/components/sidebar/TasksPanel";
import { TasksSidePanel } from "@/components/panels/TasksSidePanel";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";
import { useSidePanel } from "@/lib/context/side-panel-context";

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-foreground-subtle">Loading tasks...</div>}>
      <TasksPageInner />
    </Suspense>
  );
}

function TasksPageInner() {
  useTrackVisit("/dashboard/tasks");
  useSidePanel(<TasksSidePanel />);

  return (
    <div className="h-full overflow-y-auto">
      <TasksPanel />
    </div>
  );
}
