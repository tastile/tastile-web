"use client";

import { getLastVisitedPath } from "@/shared/hooks/use-track-visit";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

const REDIRECTABLE_PATHS = [
  "/dashboard/tasks",
  "/dashboard/projects",
  "/dashboard/schedule",
  "/dashboard/timeline",
  "/dashboard/events",
  "/dashboard/preferences/general",
  "/dashboard/preferences/account",
  "/dashboard/runtime",
  "/dashboard/api",
  "/dashboard/billing",
  "/dashboard/quota",
];

export default function DashboardPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-xs text-foreground-subtle">Loading dashboard...</div>}
    >
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const router = useRouter();

  useEffect(() => {
    const last = getLastVisitedPath();
    if (last && last !== "/dashboard" && REDIRECTABLE_PATHS.includes(last)) {
      // react-doctor-disable-next-line react-doctor/nextjs-no-client-side-redirect
      router.replace(last);
    } else {
      // react-doctor-disable-next-line react-doctor/nextjs-no-client-side-redirect
      router.replace("/dashboard/timeline");
    }
  }, [router]);

  return null;
}
