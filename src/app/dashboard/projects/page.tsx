"use client";

import { Suspense } from "react";
import { ProjectsMain } from "@/components/projects/ProjectsMain";
import { ProjectsSidePanel } from "@/components/panels/ProjectsSidePanel";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";
import { useSidePanel } from "@/lib/context/side-panel-context";

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-foreground-subtle">Loading projects...</div>}>
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
