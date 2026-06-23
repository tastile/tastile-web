"use client";

import { Suspense } from "react";
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
  useSidePanel(<ProjectsSidePanel />);

  return (
    <div className="h-full overflow-y-auto">
      <ProjectsMain />
    </div>
  );
}
