"use client";

import { Suspense } from "react";
import { CalendarMain } from "@/components/calendar/CalendarMain";

export default function ExecutePage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-foreground-subtle">Loading execution...</div>}>
      <CalendarMain initialView="day" />
    </Suspense>
  );
}
