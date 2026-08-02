import { LandingPage } from "@/features/marketing/ui/LandingPage";
import { type Lang, getMarketingDict } from "@/shared/i18n/marketing-dict";
import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";

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
