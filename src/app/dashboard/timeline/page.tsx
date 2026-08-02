import { ScheduleTimeline } from "@/features/manage-schedule/ui/ScheduleTimeline";
import { MinuteClockProvider } from "@/shared/hooks/minute-clock";
import { Suspense } from "react";

export default function TimelinePage() {
  return (
    <Suspense fallback={null}>
      <MinuteClockProvider>
        <ScheduleTimeline initialView="day" />
      </MinuteClockProvider>
    </Suspense>
  );
}
