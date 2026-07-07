"use client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useLocaleStore } from "@/lib/stores/locale-store";

export function LanguageToggle() {
  const { locale, setLocale } = useLocaleStore();
  const { t } = useTranslation();

  const toggle = () => {
    const next = locale === "ja" ? "en" : "ja";
    setLocale(next);
    const params = new URLSearchParams(window.location.search);
    params.set("lang", next);
    window.location.search = params.toString();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground transition-colors"
      title={
        locale === "ja" ? t("languageToggle.switchToEnglish") : t("languageToggle.switchToJapanese")
      }
    >
      {locale === "ja" ? "EN" : "JA"}
    </button>
  );
}
