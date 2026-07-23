import { Suspense } from "react";
import { ProjectsPageClient } from "./projects-page-client";

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-xs text-foreground-subtle">Loading projects...</div>}
    >
      <ProjectsPageClient />
    </Suspense>
  );
}
