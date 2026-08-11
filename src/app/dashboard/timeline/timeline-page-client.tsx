"use client";

import { ScheduleTimeline } from "@/features/manage-schedule/ui/ScheduleTimeline";
import { useTrackVisit } from "@/shared/hooks/use-track-visit";

export function TimelinePageClient() {
  useTrackVisit("/dashboard/timeline");
  return <ScheduleTimeline initialView="day" />;
}
