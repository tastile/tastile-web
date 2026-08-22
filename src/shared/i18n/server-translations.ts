import type { Locale } from "@/shared/stores/locale-store";
import { FALLBACK_LOCALE } from "@/shared/stores/locale-store";
import { translations } from "./translations";

type Dict = Record<string, unknown>;

function get(locale: Locale, path: string): string {
  const fallback = translations[FALLBACK_LOCALE] as Dict | undefined;
  const primary = translations[locale] as Dict | undefined;
  const read = (root: Dict | undefined): string | undefined => {
    let v: unknown = root;
    for (const seg of path.split(".")) {
      if (v && typeof v === "object" && seg in (v as Dict)) {
        v = (v as Dict)[seg];
      } else {
        return undefined;
      }
    }
    return typeof v === "string" ? v : undefined;
  };
  return read(primary) ?? read(fallback) ?? "";
}

export function getHeaderTranslations(locale: Locale) {
  return {
    features: get(locale, "marketing.nav.features"),
    pricing: get(locale, "marketing.nav.pricing"),
    download: get(locale, "marketing.nav.download"),
    login: get(locale, "marketing.nav.login"),
    getStarted: get(locale, "marketing.nav.getStarted"),
  };
}

export function getFooterTranslations(locale: Locale) {
  return {
    webApp: get(locale, "marketing.nav.webApp"),
    download: get(locale, "marketing.nav.download"),
    pricing: get(locale, "marketing.nav.pricing"),
    privacy: get(locale, "marketing.nav.privacy"),
    terms: get(locale, "marketing.nav.terms"),
    tokushoho: get(locale, "marketing.nav.tokushoho"),
    language: get(locale, "marketing.footer.language"),
    copyright: get(locale, "marketing.footer.copyright"),
  };
}
