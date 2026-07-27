import { useCallback } from "react";
import { useLocaleStore, FALLBACK_LOCALE } from "../stores/locale-store";
import { translations } from "./translations";

type Dict = Record<string, unknown>;

function lookup(tree: unknown, segments: string[]): string | undefined {
  let value: unknown = tree;
  for (const k of segments) {
    if (value && typeof value === "object" && k in (value as Dict)) {
      value = (value as Dict)[k];
    } else {
      return undefined;
    }
  }
  return typeof value === "string" ? value : undefined;
}

export function useTranslation() {
  const { locale } = useLocaleStore();

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const segments = key.split(".");
      const primary =
        lookup(translations[locale], segments) ??
        lookup(translations[FALLBACK_LOCALE], segments) ??
        "";

      if (!params) return primary;
      return primary.replace(/\{(\w+)\}/g, (_, name: string) => {
        const v = params[name];
        return v === undefined ? `{${name}}` : String(v);
      });
    },
    [locale],
  );

  return { t, locale };
}
