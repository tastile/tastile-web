"use client";

import { Suspense, useMemo } from "react";
import { ProjectsSidePanel } from "@/components/panels/ProjectsSidePanel";
import { ProjectsMain } from "@/components/projects/ProjectsMain";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-xs text-foreground-subtle">Loading projects...</div>}
    >
      <ProjectsPageInner />
    </Suspense>
  );
}

function ProjectsPageInner() {
  useTrackVisit("/dashboard/projects");
  // content をメモ化しないと毎レンダーで新規 JSX が作られ、useSidePanel →
  // setContent → 親再描画 → ページ再描画のループが "Maximum update depth
  // exceeded" を起こす
  const sidePanel = useMemo(() => <ProjectsSidePanel />, []);
  useSidePanel(sidePanel);

  return (
    <div className="h-full overflow-y-auto">
      <ProjectsMain />
    </div>
  );
}
