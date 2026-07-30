import { ScheduleTimeline } from "@/components/schedule/ScheduleTimeline";
import { MinuteClockProvider } from "@/lib/hooks/minute-clock";
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
