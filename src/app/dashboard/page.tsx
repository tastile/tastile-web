"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLastVisitedPath, useTrackVisit } from "@/lib/hooks/use-track-visit";

const REDIRECTABLE_PATHS = [
  "/dashboard/references",
  "/dashboard/tasks",
  "/dashboard/projects",
  "/dashboard/schedule",
  "/dashboard/calendar",
  "/dashboard/tiles",
  "/dashboard/timeline",
  "/dashboard/breaks",
  "/dashboard/events",
  "/dashboard/prompts",
  "/dashboard/settings",
  "/dashboard/account",
  "/dashboard/runtime",
  "/dashboard/api",
  "/dashboard/billing",
  "/dashboard/quota",
  "/dashboard/integrations",
];

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-foreground-subtle">Loading dashboard...</div>}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const router = useRouter();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    const last = getLastVisitedPath();
    if (last && last !== "/dashboard" && REDIRECTABLE_PATHS.includes(last)) {
      router.replace(last);
      setRedirected(true);
    } else {
      router.replace("/dashboard/calendar");
    }
  }, [router]);

  return null;
}
