"use client";

import { ProjectsSidePanel } from "@/components/panels/ProjectsSidePanel";
import { ProjectsMain } from "@/components/projects/ProjectsMain";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

const PROJECTS_SIDE_PANEL = <ProjectsSidePanel />;

export function ProjectsPageClient() {
  useTrackVisit("/dashboard/projects");
  useSidePanel(PROJECTS_SIDE_PANEL);

  return (
    <div className="h-full overflow-y-auto">
      <ProjectsMain />
    </div>
  );
}
