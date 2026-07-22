import { Check } from "lucide-react";
import Link from "next/link";
import { PricingCard } from "@/components/marketing/PricingCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getFooterTranslations, getHeaderTranslations } from "@/lib/i18n/server-translations";
import { translations } from "@/lib/i18n/translations";

export const metadata = {
  title: "Pricing — Tastile",
  description: "Simple, transparent pricing for Tastile.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = params.lang === "en" ? "en" : "ja";
  const dict = translations[lang].marketing.pricing;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader showFeatureLink translations={getHeaderTranslations(lang)} />
      <main className="flex-1">
        <div className="layout-shell max-w-5xl py-20">
          <div>
            <h1 className="text-4xl font-[510] tracking-[-0.03em] text-foreground">{dict.title}</h1>
            <p className="mt-4 text-lg text-foreground-muted">{dict.subtitle}</p>
          </div>

          <div className="layout-grid-2 mt-16 gap-8 items-stretch">
            {/* Free Plan */}
            <div className="flex flex-col rounded-xl border border-border bg-surface-elevated p-8">
              <h2 className="text-2xl font-[590] text-foreground">{dict.freePlan}</h2>
              <p className="mt-2 text-foreground-muted">{dict.freeDesc}</p>
              <p className="mt-4 text-4xl font-[590] text-foreground">$0</p>

              <ul className="mt-8 space-y-4">
                {dict.freeFeatures.map((f) => (
                  <li key={f.title} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-success mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">{f.title}</span>
                      <p className="text-sm text-foreground-muted">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <Link
                  href="/login"
                  className="block w-full rounded-full bg-surface-2 px-4 py-3 text-center text-sm font-semibold text-foreground hover:bg-surface-3 transition-colors"
                >
                  {dict.getStarted}
                </Link>
              </div>
            </div>

            {/* Pro Plan (client component for interactivity) */}
            <PricingCard />
          </div>
        </div>
      </main>
      <SiteFooter translations={getFooterTranslations(lang)} />
    </div>
  );
}
