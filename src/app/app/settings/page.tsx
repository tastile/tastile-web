import { useTranslation } from "@/shared/i18n/use-translation";

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-[590] text-foreground">{t("dashboard.legacy.settingsTitle")}</h1>
    </div>
  );
}