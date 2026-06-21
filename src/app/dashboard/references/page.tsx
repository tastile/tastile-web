"use client";

import { Suspense } from "react";
import { ReferencesMain } from "@/components/references/ReferencesMain";
import { ReferencesSidePanel } from "@/components/panels/ReferencesSidePanel";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";
import { useSidePanel } from "@/lib/context/side-panel-context";

export default function ReferencesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-foreground-subtle">Loading references...</div>}>
      <ReferencesPageInner />
    </Suspense>
  );
}

function ReferencesPageInner() {
  useTrackVisit("/dashboard/references");
  useSidePanel(<ReferencesSidePanel />);

  return (
    <div className="h-full overflow-y-auto">
      <ReferencesMain />
    </div>
  );
}
