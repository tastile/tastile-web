"use client";

import { getLastVisitedPath } from "@/shared/hooks/use-track-visit";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { decideRedirectTarget } from "./redirect-target";

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
    // react-doctor-disable-next-line react-doctor/nextjs-no-client-side-redirect
    router.replace(decideRedirectTarget(getLastVisitedPath()));
  }, [router]);

  return null;
}
