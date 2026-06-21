"use client";

import { ReferencesPanel } from "@/components/sidebar/ReferencesPanel";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

export default function ReferencesPage() {
  useTrackVisit("/dashboard/references");
  return (
    <div className="h-full overflow-y-auto">
      <ReferencesPanel />
    </div>
  );
}
