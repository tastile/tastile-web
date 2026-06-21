"use client";

import { ProjectsPanel } from "@/components/sidebar/ProjectsPanel";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

export default function ProjectsPage() {
  useTrackVisit("/dashboard/projects");
  return (
    <div className="h-full overflow-y-auto">
      <ProjectsPanel />
    </div>
  );
}
