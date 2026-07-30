import { ScheduleTimeline } from "@/components/schedule/ScheduleTimeline";
import { MinuteClockProvider } from "@/lib/hooks/minute-clock";
import { notFound } from "next/navigation";
import { Suspense } from "react";

const VALID_VIEWS = ["day", "week", "month", "year", "agenda"] as const;
type View = (typeof VALID_VIEWS)[number];

function isView(v: string | undefined): v is View {
  return !!v && (VALID_VIEWS as readonly string[]).includes(v);
}

export default async function TimelineViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!isView(view)) notFound();
  return (
    <Suspense fallback={null}>
      <MinuteClockProvider>
        <ScheduleTimeline initialView={view} />
      </MinuteClockProvider>
    </Suspense>
  );
}
