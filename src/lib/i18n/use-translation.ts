import { useCallback } from "react";
import { useLocaleStore } from "../stores/locale-store";
import { translations } from "./translations";

export function useTranslation() {
  const { locale } = useLocaleStore();

  const t = useCallback((key: string): string => {
    const keys = key.split(".");
    let value: unknown = translations[locale];

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }

    return typeof value === "string" ? value : key;
  }, [locale]);

  return { t, locale };
}
