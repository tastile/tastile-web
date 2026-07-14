"use client";

import { Suspense } from "react";
import { CalendarMain } from "@/components/calendar/CalendarMain";

export default function CalendarPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-xs text-foreground-subtle">Loading calendar...</div>}
    >
      <CalendarMain initialView="day" />
    </Suspense>
  );
}
