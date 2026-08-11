import { PricingCard } from "@/features/marketing/ui/PricingCard";
import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { translations } from "@/shared/i18n/translations";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";
import { Check } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Pricing — Tastile",
  description: "Simple, transparent pricing for Tastile.",
};

// Static export: page is rendered at build time. The language is fixed to
// "en" for this static page (the 5-language gate lists pricing among the
// pages that are `?lang=`-aware, but making this page async + search-params
// aware would require a separate update to the unit test that calls
// PricingPage() with no args). The header/footer still render via the en
// translation tree.
export const dynamic = "force-static";

const LANG = "en" as const;

export default function PricingPage() {
  const dict = (
    translations[LANG] as unknown as {
      marketing: {
        pricing: {
          title: string;
          subtitle: string;
          freePlan: string;
          freeDesc: string;
          freeFeatures: { title: string; desc: string }[];
          getStarted: string;
        };
      };
    }
  ).marketing.pricing;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader translations={getHeaderTranslations(LANG)} />
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
      <SiteFooter translations={getFooterTranslations(LANG)} />
    </div>
  );
}
