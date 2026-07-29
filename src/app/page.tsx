import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LandingPage } from "@/components/marketing/LandingPage";
import { type Lang, getMarketingDict } from "@/lib/i18n/marketing-dict";
import { getFooterTranslations, getHeaderTranslations } from "@/lib/i18n/server-translations";

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const lang: Lang = params.lang === "en" ? "en" : "ja";
  const t = getMarketingDict(lang);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <SiteHeader showFeatureLink translations={getHeaderTranslations(lang)} />
      <main className="flex-1">
        <LandingPage t={t} lang={lang} />
      </main>
      <SiteFooter translations={getFooterTranslations(lang)} />
    </div>
  );
}
