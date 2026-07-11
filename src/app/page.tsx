import { LandingPage, type Lang, landingDict } from "@/components/marketing/LandingPage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getFooterTranslations, getHeaderTranslations } from "@/lib/i18n/server-translations";

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const lang: Lang = params.lang === "en" ? "en" : "ja";
  const t = landingDict[lang];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader showFeatureLink translations={getHeaderTranslations(lang)} />
      <main className="flex-1">
        <LandingPage t={t} lang={lang} />
      </main>
      <SiteFooter translations={getFooterTranslations(lang)} />
    </div>
  );
}
