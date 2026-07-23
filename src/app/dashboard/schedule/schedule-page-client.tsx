"use client";

import { ScheduleSidePanel } from "@/components/panels/ScheduleSidePanel";
import { ScheduleMain } from "@/components/schedule/ScheduleMain";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

const SCHEDULE_SIDE_PANEL = <ScheduleSidePanel />;

export function SchedulePageClient() {
  useTrackVisit("/dashboard/schedule");
  useSidePanel(SCHEDULE_SIDE_PANEL);

  return (
    <div className="h-full overflow-y-auto">
      <ScheduleMain />
    </div>
  );
}
