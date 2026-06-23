"use client";

import { Suspense } from "react";
import { TasksSidePanel } from "@/components/panels/TasksSidePanel";
import { TasksMain } from "@/components/tasks/TasksMain";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

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
      <TasksMain />
    </div>
  );
}
