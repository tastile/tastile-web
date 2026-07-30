import { Suspense } from "react";
import { ScheduleTimeline } from "@/components/schedule/ScheduleTimeline";
import { MinuteClockProvider } from "@/lib/hooks/minute-clock";

export default function TimelinePage() {
  return (
    <Suspense fallback={null}>
      <MinuteClockProvider>
        <ScheduleTimeline initialView="day" />
      </MinuteClockProvider>
    </Suspense>
  );
}
