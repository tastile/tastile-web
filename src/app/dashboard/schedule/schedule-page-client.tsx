"use client";

import { ScheduleMain } from "@/features/manage-schedule/ui/ScheduleMain";
import { ScheduleSidePanel } from "@/features/manage-schedule/ui/ScheduleSidePanel";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { useTrackVisit } from "@/shared/hooks/use-track-visit";

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
