"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { translations } from "@/lib/i18n/translations";
import { useTranslation } from "@/lib/i18n/use-translation";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const { t, locale } = useTranslation();
  const dict = translations[locale].marketing.pricing;

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader showFeatureLink />
      <main className="flex-1">
        <div className="layout-shell max-w-5xl py-20">
          <div>
            <h1 className="text-4xl font-[510] tracking-[-0.03em] text-foreground">
              {t("marketing.pricing.title")}
            </h1>
            <p className="mt-4 text-lg text-foreground-muted">{t("marketing.pricing.subtitle")}</p>
          </div>

          <div className="layout-grid-2 mt-16 gap-8 items-stretch">
            {/* Free Plan */}
            <div className="flex flex-col rounded-xl bg-surface-elevated p-8">
              <h2 className="text-2xl font-[590] text-foreground">
                {t("marketing.pricing.freePlan")}
              </h2>
              <p className="mt-2 text-foreground-muted">{t("marketing.pricing.freeDesc")}</p>
              <p className="mt-4 text-4xl font-[590] text-foreground">$0</p>

              <ul className="mt-8 space-y-4">
                {dict.freeFeatures.map((f) => (
                  <li key={f.title} className="flex items-start">
                    <svg
                      className="h-6 w-6 text-success mr-3 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <title>Checkmark</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
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
                  className="block w-full rounded-full bg-surface-1 px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-surface-2"
                >
                  {t("marketing.pricing.getStarted")}
                </Link>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="flex flex-col relative overflow-hidden rounded-xl bg-surface-elevated p-8">
              <div className="absolute top-4 right-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
                {t("marketing.pricing.popular")}
              </div>
              <h2 className="text-2xl font-[590] text-foreground">
                {t("marketing.pricing.proPlan")}
              </h2>
              <p className="mt-2 text-foreground-muted">{t("marketing.pricing.proDesc")}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setInterval("monthly")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${interval === "monthly" ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground-subtle hover:text-foreground"}`}
                >
                  {t("marketing.pricing.monthly")}
                </button>
                <button
                  type="button"
                  onClick={() => setInterval("yearly")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${interval === "yearly" ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground-subtle hover:text-foreground"}`}
                >
                  {t("marketing.pricing.yearly")}{" "}
                  <span className="text-success">{t("marketing.pricing.yearlySave")}</span>
                </button>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-[590] text-foreground">
                  {interval === "monthly" ? "$4" : "$40"}
                </span>
                <span className="ml-2 text-foreground-muted">
                  {interval === "monthly"
                    ? t("marketing.pricing.perMonth")
                    : t("marketing.pricing.perYear")}
                </span>
              </div>

              <ul className="mt-8 space-y-4">
                {dict.proFeatures.map((f) => (
                  <li key={f.title} className="flex items-start">
                    <svg
                      className="h-6 w-6 text-success mr-3 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <title>Checkmark</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <div>
                      <span className="font-medium text-foreground">{f.title}</span>
                      <p className="text-sm text-foreground-muted">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <button
                  type="button"
                  onClick={handleUpgrade}
                  disabled={isLoading}
                  className="block w-full rounded-full bg-primary px-4 py-3 text-center text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
                >
                  {isLoading ? t("marketing.pricing.loading") : t("marketing.pricing.upgrade")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

