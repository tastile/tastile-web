"use client";

import { SchedulePanel } from "@/components/sidebar/SchedulePanel";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

export default function SchedulePage() {
  useTrackVisit("/dashboard/schedule");
  return (
    <div className="h-full overflow-y-auto">
      <SchedulePanel />
    </div>
  );
}
