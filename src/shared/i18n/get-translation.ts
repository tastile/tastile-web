import type { Locale } from "@/shared/stores/locale-store";
import { FALLBACK_LOCALE } from "@/shared/stores/locale-store";
import { translations } from "./translations";

type Dict = Record<string, unknown>;

// Server-side translation lookup. Mirrors the private `get()` helper in
// `server-translations.ts` but is exported so server components in tier 6
// (`app/auth/*`, `legal/*`, `not-found`) can resolve `dot.path` keys
// without depending on the WIP `server-translations.ts` extension surface.
export function getTranslation(locale: Locale, key: string): string {
  const fallback = translations[FALLBACK_LOCALE] as Dict | undefined;
  const primary = translations[locale] as Dict | undefined;
  const read = (root: Dict | undefined): string | undefined => {
    let v: unknown = root;
    for (const seg of key.split(".")) {
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
