"use client";

import { translations } from "@/shared/i18n/translations";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Check } from "lucide-react";

export function PricingCard() {
	// W06 (2026-09-19 free launch): the page exposes the Free plan only.
	// No checkout / upgrade CTA, no interval toggle.
	const { t, locale } = useTranslation();
	const proFeatures = (
		translations[locale] as unknown as {
			marketing: { pricing: { proFeatures: { title: string; desc: string }[] } };
		}
	).marketing.pricing.proFeatures;

	return (
		<div className="flex flex-col relative overflow-hidden rounded-xl border border-border bg-surface-elevated p-8">
			<div className="absolute top-4 right-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
				{t("marketing.pricing.popular")}
			</div>
			<h2 className="text-2xl font-[590] text-foreground">
				{t("marketing.pricing.proPlan")}
			</h2>
			<p className="mt-2 text-foreground-muted">
				{t("marketing.pricing.proDesc")}
			</p>

			<ul className="mt-8 space-y-4">
				{proFeatures.map((f) => (
					<li key={f.title} className="flex items-start gap-3">
						<Check className="size-5 text-success mt-0.5 shrink-0" />
						<div>
							<span className="font-medium text-foreground">{f.title}</span>
							<p className="text-sm text-foreground-muted">{f.desc}</p>
						</div>
					</li>
				))}
			</ul>

			<div className="mt-auto pt-8 text-center text-sm text-foreground-muted">
				{t("marketing.pricing.subtitle")}
			</div>
		</div>
	);
}
