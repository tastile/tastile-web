import type { Locale } from "@/shared/stores/locale-store";

// Locale catalog carried by the marketing tree. The `marketingLanding` copy
// only ships for `ja` and `en`, so any non-ja/non-en selection falls back to
// the English strings inside `getMarketingDict`. The other three (`zh-CN`,
// `ko`, `es`) still pick up the localized nav / footer / hero sub copy.
const SUPPORTED_LOCALES = ["en", "ja", "zh-CN", "ko", "es"] as const satisfies readonly Locale[];

// `zh-CN` is the only Chinese variant in the catalog. Accept the generic
// `zh` subtag and the Simplified-script / region shapes (`zh-CN`, `zh-Hans`,
// `zh-Hans-CN`); explicitly DO NOT match `zh-TW` / `zh-HK` / `zh-Hant*` —
// those are Traditional Chinese and would deserve their own copy if/when we
// add it.
const ZH_CN_TAGS = new Set([
  "zh",
  "zh-cn",
  "zh-hans",
  "zh-hans-cn",
]);

type ParsedTag = { tag: string; q: number };

function parseAcceptLanguage(header: string): ParsedTag[] {
  if (!header) return [];
  const out: ParsedTag[] = [];
  for (const part of header.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const segments = trimmed.split(";");
    const tagRaw = segments[0];
    if (!tagRaw) continue;
    const tag = tagRaw.trim().toLowerCase();
    if (!tag || tag === "*") continue;
    let q = 1;
    for (const param of segments.slice(1)) {
      const match = param.trim().match(/^q\s*=\s*([0-9.]+)$/);
      if (!match) continue;
      const parsed = Number.parseFloat(match[1]);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) continue;
      q = parsed;
    }
    out.push({ tag, q });
  }
  // RFC 7231 §5.3.5: higher q first; stable order on ties.
  return out.sort((a, b) => b.q - a.q);
}

function mapTagToLocale(tag: string): Locale | null {
  if ((SUPPORTED_LOCALES as readonly string[]).includes(tag)) {
    return tag as Locale;
  }
  if (ZH_CN_TAGS.has(tag)) return "zh-CN";
  // Region / script stripped: `ja-JP` → `ja`, `ko-KR` → `ko`, `es-MX` → `es`.
  const language = tag.split("-")[0];
  switch (language) {
    case "en":
    case "ja":
    case "ko":
    case "es":
      return language;
    default:
      return null;
  }
}

// Resolve the device-preferred locale for the marketing landing page.
// Returns `null` when the header is absent, malformed, or carries no
// supported language — callers should fall back to `FALLBACK_LOCALE`.
export function negotiateAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  for (const { tag } of parseAcceptLanguage(header ?? "")) {
    const mapped = mapTagToLocale(tag);
    if (mapped) return mapped;
  }
  return null;
}

export const _internalsForTest = {
  parseAcceptLanguage,
  mapTagToLocale,
  SUPPORTED_LOCALES,
};
