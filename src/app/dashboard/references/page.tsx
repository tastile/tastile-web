"use client";

import { Suspense } from "react";
import { ReferencesSidePanel } from "@/components/panels/ReferencesSidePanel";
import { ReferencesMain } from "@/components/references/ReferencesMain";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

export default function ReferencesPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-xs text-foreground-subtle">Loading references...</div>}
    >
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
