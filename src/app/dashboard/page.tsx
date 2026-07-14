"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { getLastVisitedPath } from "@/lib/hooks/use-track-visit";

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
      router.replace(last);
    } else {
      router.replace("/dashboard/timeline");
    }
  }, [router]);

  return null;
}
