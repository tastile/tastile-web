import { FALLBACK_LOCALE, type Locale } from "@/shared/stores/locale-store";
import { cookies, headers } from "next/headers";
import { negotiateAcceptLanguage } from "./accept-language";
import { LOCALE_COOKIE } from "./locale-cookie";

// The marketing-tree Locale catalog. Mirrors the `SUPPORTED_LANGS` tuple
// that each page previously hand-rolled; centralizing it here keeps the
// switcher / cookie / Accept-Language pipeline in one place.
const SUPPORTED_LANGS = ["en", "ja", "zh-CN", "ko", "es"] as const satisfies readonly Locale[];

function isSupported(value: string | undefined): value is Locale {
  return typeof value === "string" && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

export type ResolveLocaleInput = {
  queryLang?: string;
  cookieValue?: string;
  acceptLanguage?: string | null;
};

// Pure resolver. Public so unit tests can exercise the priority chain
// without having to mock `next/headers` / `cookies()` / `headers()`.
export function resolveLocale({
  queryLang,
  cookieValue,
  acceptLanguage,
}: ResolveLocaleInput): Locale {
  // Priority: explicit `?lang=` query > saved `NEXT_LOCALE` cookie >
  // device `Accept-Language` > English fallback. The query param is the
  // only one that survives a shared-URL handoff; the cookie is the user's
  // saved preference; the header is the device default.
  if (isSupported(queryLang)) return queryLang;
  if (isSupported(cookieValue)) return cookieValue;
  return negotiateAcceptLanguage(acceptLanguage) ?? FALLBACK_LOCALE;
}

// Server-side wrapper: reads from `next/headers` so pages can do
// `const locale = await resolveMarketingLocale({ searchParams })`. The
// search-param shape matches the existing `?lang=` affordance used by the
// home and download pages.
export async function resolveMarketingLocale({
  searchParams,
}: {
  searchParams: { lang?: string } | Promise<{ lang?: string }>;
}): Promise<Locale> {
  const params = await Promise.resolve(searchParams);
  const queryLang = params?.lang;
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  const acceptLanguage = (await headers()).get("accept-language");
  return resolveLocale({ queryLang, cookieValue, acceptLanguage });
}

