"use client";

import { Suspense } from "react";
import { CalendarMain } from "@/components/calendar/CalendarMain";
import { MinuteClockProvider } from "@/lib/hooks/minute-clock";

export default function CalendarPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-xs text-foreground-subtle">Loading calendar...</div>}
    >
      <MinuteClockProvider>
        <CalendarMain initialView="day" />
      </MinuteClockProvider>
    </Suspense>
  );
}
