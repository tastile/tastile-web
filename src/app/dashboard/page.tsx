"use client";

import { getLastVisitedPath } from "@/shared/hooks/use-track-visit";
import { useTranslation } from "@/shared/i18n/use-translation";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { decideRedirectTarget } from "./redirect-target";

export default function DashboardPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="p-6 text-xs text-foreground-subtle">{t("dashboard.loading.dashboard")}</div>
      }
    >
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const router = useRouter();

  useEffect(() => {
    const target = decideRedirectTarget(getLastVisitedPath());
    // react-doctor-disable-next-line react-doctor/nextjs-no-client-side-redirect
    router.replace(target);
  }, [router]);

  return null;
}