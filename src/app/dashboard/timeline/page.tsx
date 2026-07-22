"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { MinuteClockProvider } from "@/lib/hooks/minute-clock";

const CalendarMain = dynamic(
  () => import("@/components/calendar/CalendarMain").then((m) => m.CalendarMain),
  {
    ssr: false,
    loading: () => <div className="p-6 text-xs text-foreground-subtle">Loading calendar...</div>,
  },
);

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
