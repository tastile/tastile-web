import { useTranslation } from "@/shared/i18n/use-translation";

export default function TilesPage() {
  const { t } = useTranslation();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-[590] text-foreground">{t("dashboard.legacy.tilesTitle")}</h1>
      <p className="mt-2 text-foreground-muted">{t("dashboard.legacy.tilesDescription")}</p>
    </div>
  );
}