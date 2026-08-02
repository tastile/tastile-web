"use client";

import { ProjectsMain } from "@/features/manage-projects/ui/ProjectsMain";
import { ProjectsSidePanel } from "@/features/manage-projects/ui/ProjectsSidePanel";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { useTrackVisit } from "@/shared/hooks/use-track-visit";

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
