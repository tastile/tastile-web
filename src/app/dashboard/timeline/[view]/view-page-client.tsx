"use client";

import { ScheduleTimeline } from "@/features/manage-schedule/ui/ScheduleTimeline";
import { useTrackVisit } from "@/shared/hooks/use-track-visit";

type Props = {
  view: "day" | "week" | "month" | "year" | "agenda";
};

export function ViewPageClient({ view }: Props) {
  useTrackVisit(`/dashboard/timeline/${view}`);
  return <ScheduleTimeline initialView={view} />;
}
