"use client";

import { useTranslation } from "@/shared/i18n/use-translation";

export default function ExecutePage() {
  const { t } = useTranslation();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-[590] text-foreground">{t("dashboard.legacy.executeTitle")}</h1>
      <p className="mt-2 text-foreground-muted">{t("dashboard.legacy.executeDescription")}</p>
    </div>
  );
}