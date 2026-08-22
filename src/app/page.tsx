import { LandingPage } from "@/features/marketing/ui/LandingPage";
import { type Lang, getMarketingDict } from "@/shared/i18n/marketing-dict";
import { resolveMarketingLocale } from "@/shared/i18n/resolve-locale";
import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  // Priority chain (?lang= > NEXT_LOCALE cookie > Accept-Language > en)
  // lives in resolve-locale; the landing dict only distinguishes ja / en,
  // so other locales fall through to the en tree inside getMarketingDict.
  const locale = await resolveMarketingLocale({ searchParams });
  const lang = locale as Lang;
  const t = getMarketingDict(lang);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <SiteHeader translations={getHeaderTranslations(lang)} />
      <main className="flex-1">
        <LandingPage t={t} lang={lang} />
      </main>
      <SiteFooter translations={getFooterTranslations(lang)} locale={locale} />
    </div>
  );
}
