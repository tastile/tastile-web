import { PricingCard } from "@/features/marketing/ui/PricingCard";
import { getTranslation } from "@/shared/i18n/get-translation";
import {
	getFooterTranslations,
	getHeaderTranslations,
} from "@/shared/i18n/server-translations";
import { translations } from "@/shared/i18n/translations";
import type { Locale } from "@/shared/stores/locale-store";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";
import { Check } from "lucide-react";
import Link from "next/link";

export const metadata = {
	title: getTranslation("en", "metadata.pricing.title"),
	description: getTranslation("en", "metadata.pricing.description"),
};

// W06 (2026-09-19 free launch): /pricing is locale-aware via the same
// ?lang= > cookie > Accept-Language > en chain the rest of the marketing
// surface uses. The previous `dynamic = "force-static"` / hardcoded
// `LANG = "en"` shape locked the page into the English copy and broke
// the W06 #81 "全 locale を実 browser で確認" gate — ja/zh-CN/ko/es
// silently fell through to the en tree. We render at request time now.
const SUPPORTED_LANGS = [
	"en",
	"ja",
	"zh-CN",
	"ko",
	"es",
] as const satisfies readonly Locale[];

export default async function PricingPage({
	searchParams,
}: {
	searchParams: Promise<{ lang?: string }>;
}) {
	const requested = (await searchParams).lang;
	const locale: Locale = (SUPPORTED_LANGS as readonly string[]).includes(
		requested ?? "",
	)
		? (requested as Locale)
		: "en";
	const dict = (
		translations[locale] as unknown as {
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
			<SiteHeader translations={getHeaderTranslations(locale)} />
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
										<Check className="size-5 text-success mt-0.5 shrink-0" />
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
			<SiteFooter translations={getFooterTranslations(locale)} locale={locale}/>
		</div>
	);
}
