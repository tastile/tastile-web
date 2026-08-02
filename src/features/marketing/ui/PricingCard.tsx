"use client";

import { translations } from "@/shared/i18n/translations";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Button } from "@mantine/core";
import { Check } from "lucide-react";
import { useState } from "react";

export function PricingCard() {
  const [isLoading, setIsLoading] = useState(false);
  // Avoid naming the state setter `setInterval`: the effect-needs-cleanup rule
  // flags any `setInterval(...)` call as if it were a real timer, which is a
  // false positive for React useState setters. Use a distinct identifier so
  // the rule disappears without an eslint suppression.
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "yearly">("monthly");
  const { t, locale } = useTranslation();
  const dict = (
    translations[locale] as unknown as {
      marketing: { pricing: { proFeatures: { title: string; desc: string }[] } };
    }
  ).marketing.pricing;

  const handleUpgrade = () => {
    setIsLoading(true);
    void postCheckout(selectedInterval)
      .then((url) => {
        if (url) window.location.href = url;
      })
      .catch(() => {
        // network/parse failure is non-fatal: leave the user on the page so
        // they can retry; loading flag is reset below either way.
      })
      .then(() => {
        setIsLoading(false);
      });
  };

  return (
    <div className="flex flex-col relative overflow-hidden rounded-xl border border-border bg-surface-elevated p-8">
      <div className="absolute top-4 right-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
        {t("marketing.pricing.popular")}
      </div>
      <h2 className="text-2xl font-[590] text-foreground">{t("marketing.pricing.proPlan")}</h2>
      <p className="mt-2 text-foreground-muted">{t("marketing.pricing.proDesc")}</p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="subtle"
          size="compact-sm"
          onClick={() => setSelectedInterval("monthly")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedInterval === "monthly" ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground-subtle hover:text-foreground"}`}
        >
          {t("marketing.pricing.monthly")}
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="compact-sm"
          onClick={() => setSelectedInterval("yearly")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedInterval === "yearly" ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground-subtle hover:text-foreground"}`}
        >
          {t("marketing.pricing.yearly")}{" "}
          <span className="text-success">{t("marketing.pricing.yearlySave")}</span>
        </Button>
      </div>
      <div className="mt-4 flex items-baseline">
        <span className="text-4xl font-[590] text-foreground">
          {selectedInterval === "monthly" ? "$4" : "$40"}
        </span>
        <span className="ml-2 text-foreground-muted">
          {selectedInterval === "monthly"
            ? t("marketing.pricing.perMonth")
            : t("marketing.pricing.perYear")}
        </span>
      </div>

      <ul className="mt-8 space-y-4">
        {dict.proFeatures.map((f) => (
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
        <Button
          type="button"
          variant="subtle"
          size="compact-sm"
          onClick={handleUpgrade}
          disabled={isLoading}
          className="block w-full rounded-full bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {isLoading ? t("marketing.pricing.loading") : t("marketing.pricing.upgrade")}
        </Button>
      </div>
    </div>
  );
}

// Module-local helper extracted out of the component body so the React
// Compiler does not have to model a try/catch/finally inside the render path.
// The Promise chain drives the success/failure/loading-reset states explicitly.
async function postCheckout(interval: "monthly" | "yearly"): Promise<string | null> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interval }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { url?: string };
  return typeof body.url === "string" ? body.url : null;
}
