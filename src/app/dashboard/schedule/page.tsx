import { Suspense } from "react";
import { SchedulePageClient } from "./schedule-page-client";

export default function SchedulePage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-xs text-foreground-subtle">Loading schedule...</div>}
    >
      <SchedulePageClient />
    </Suspense>
  );
}
