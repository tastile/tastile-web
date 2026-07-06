"use client";

import { Suspense, useMemo } from "react";
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
  // メモ化しないと毎レンダーで新規 JSX が作られ useSidePanel → setContent
  // → 親再描画 → ページ再描画のループが "Maximum update depth exceeded"
  // を起こす
  const sidePanel = useMemo(() => <TasksSidePanel />, []);
  useSidePanel(sidePanel);

  return (
    <div className="h-full overflow-y-auto">
      <TasksMain />
    </div>
  );
}
