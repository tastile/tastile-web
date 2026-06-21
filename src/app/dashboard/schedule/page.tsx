"use client";

import { Suspense } from "react";
import { ScheduleMain } from "@/components/schedule/ScheduleMain";
import { ScheduleSidePanel } from "@/components/panels/ScheduleSidePanel";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";
import { useSidePanel } from "@/lib/context/side-panel-context";

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-foreground-subtle">Loading schedule...</div>}>
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
