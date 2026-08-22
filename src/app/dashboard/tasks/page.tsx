"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { Suspense } from "react";
import { TasksPageClient } from "./page-client";

export default function TasksPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="p-6 text-xs text-foreground-subtle">{t("dashboard.loading.tasks")}</div>
      }
    >
      <TasksPageClient />
    </Suspense>
  );
}