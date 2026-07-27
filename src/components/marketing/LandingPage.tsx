import { ConditionBento } from "./ConditionBento";
import { CtaSection } from "./CtaSection";
import { Faq } from "./Faq";
import { Hero } from "./Hero";
import { LifecycleLoop } from "./LifecycleLoop";
import type { Dict, Lang } from "@/lib/i18n/marketing-dict";
import { Manifesto } from "./Manifesto";
import { PricingTeaser } from "./PricingTeaser";
import "./marketing.css";

export type { Dict, Lang };

export function LandingPage({ t, lang }: { t: Dict; lang: Lang }) {
  return (
    <div className="bg-background text-foreground">
      <Hero t={t.hero} lang={lang} />
      <ConditionBento t={t.bento} lang={lang} />
      <LifecycleLoop t={t.lifecycle} lang={lang} />
      <Manifesto t={t.manifesto} lang={lang} />
      <PricingTeaser t={t.pricing} lang={lang} />
      <Faq t={t.faq} lang={lang} />
      <CtaSection t={t.finalCta} lang={lang} />
    </div>
  );
}
