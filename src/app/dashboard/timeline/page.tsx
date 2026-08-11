import { MinuteClockProvider } from "@/shared/hooks/minute-clock";
import { Suspense } from "react";
import { TimelinePageClient } from "./timeline-page-client";

export default function TimelinePage() {
  return (
    <Suspense fallback={null}>
      <MinuteClockProvider>
        <TimelinePageClient />
      </MinuteClockProvider>
    </Suspense>
  );
}
