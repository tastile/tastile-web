import { LandingPage } from "@/features/marketing/ui/LandingPage";
import { type Lang, getMarketingDict } from "@/shared/i18n/marketing-dict";
import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { type Locale } from "@/shared/stores/locale-store";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";

const SUPPORTED_LANGS = ["en", "ja", "zh-CN", "ko", "es"] as const satisfies readonly Locale[];

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const requested = params.lang;
  const locale: Locale = (SUPPORTED_LANGS as readonly string[]).includes(requested ?? "")
    ? (requested as Locale)
    : "en";
  // The landing-page `Dict` only has content for ja / en; non-ja/non-en
  // locales fall through to the en tree inside `getMarketingDict`. Cast
  // back to the legacy 2-value `Lang` for the 7 marketing components
  // which still type their `lang` prop as "ja" | "en".
  const lang = locale as Lang;
  const t = getMarketingDict(lang);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <SiteHeader translations={getHeaderTranslations(lang)} />
      <main className="flex-1">
        <LandingPage t={t} lang={lang} />
      </main>
      <SiteFooter translations={getFooterTranslations(lang)} />
    </div>
  );
}
