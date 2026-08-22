import { useTranslation } from "@/shared/i18n/use-translation";
import { Suspense } from "react";
import { ProjectsPageClient } from "./page-client";

export default function ProjectsPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="p-6 text-xs text-foreground-subtle">{t("dashboard.loading.projects")}</div>
      }
    >
      <ProjectsPageClient />
    </Suspense>
  );
}