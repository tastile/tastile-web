"use client";

import { Suspense } from "react";
import { ScheduleSidePanel } from "@/components/panels/ScheduleSidePanel";
import { ScheduleMain } from "@/components/schedule/ScheduleMain";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

export default function SchedulePage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-xs text-foreground-subtle">Loading schedule...</div>}
    >
      <SchedulePageInner />
    </Suspense>
  );
}

function SchedulePageInner() {
  useTrackVisit("/dashboard/schedule");
  useSidePanel(<ScheduleSidePanel />);

  return (
    <div className="h-full overflow-y-auto">
      <ScheduleMain />
    </div>
  );
}
