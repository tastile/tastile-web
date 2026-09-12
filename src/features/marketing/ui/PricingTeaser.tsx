"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import type { Dict, Lang } from "./LandingPage";

export function PricingTeaser({ t, lang }: { t: Dict["pricing"]; lang: Lang }) {
	// W06 (2026-09-19 free launch): a single Free band, no interval toggle,
	// no upgrade CTA.
	const isJa = lang === "ja";
	const display = isJa
		? "font-[family-name:var(--font-zen-kaku)]"
		: "font-[family-name:var(--font-outfit)]";
	const body = isJa ? "font-[family-name:var(--font-jp)]" : "";
	const mono = "font-[family-name:var(--font-geist-mono)]";

	return (
		<section className="relative overflow-hidden py-20 lg:py-32">
			{/* Background giant numeral. */}
			<div
				aria-hidden
				className="pointer-events-none absolute top-12 right-[-1rem] z-0 select-none lg:right-[-2rem]"
			>
				<p className={`mkt-giant-numeral ${mono}`}>04</p>
			</div>

			<div className="layout-shell relative z-10">
				<header className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:items-end">
					<div>
						<p className="text-caption font-medium uppercase tracking-[0.22em] text-foreground-muted">
							{t.eyebrow}
						</p>
						<h2 className={`mt-3 mkt-display-2 text-foreground ${display}`}>
							<span className="block">{t.title[0]}</span>
							<span className="block">{t.title[1]}</span>
						</h2>
					</div>
					<div className="lg:pb-2">
						<p className={`max-w-[60ch] text-lg leading-relaxed text-foreground-muted ${body}`}>
							{t.intro}
						</p>
					</div>
				</header>

				<div className="mt-12 lg:mt-16">
					<article className="mkt-price-band grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-[10rem_1fr_2fr_auto] lg:items-center lg:gap-12">
						<div>
							<p
								className={`text-caption font-medium uppercase tracking-[0.22em] text-foreground-muted ${display}`}
							>
								{t.bandPrefixFree}
								{t.free.name}
							</p>
							<p
								className={`mt-3 text-4xl font-semibold leading-none tracking-tight text-foreground lg:text-6xl ${display}`}
							>
								{t.free.price}
							</p>
						</div>
						<div>
							<p
								className={`text-caption font-medium uppercase tracking-[0.18em] text-foreground-subtle ${display}`}
							>
								{t.forLabel}
							</p>
							<p className={`mt-2 text-base text-foreground-muted ${body}`}>
								{t.free.tagline}
							</p>
						</div>
						<ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 sm:col-span-2 lg:col-span-1">
							{t.free.features.map((feature) => (
								<li key={feature.title} className="flex items-start gap-3">
									<span className="mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground-muted/15 text-foreground-muted">
										<Check className="size-2.5" strokeWidth={2.5} />
									</span>
									<div>
										<p className={`text-sm font-medium text-foreground ${display}`}>
											{feature.title}
										</p>
										<p className={`mt-0.5 text-sm leading-relaxed text-foreground-muted ${body}`}>
											{feature.detail}
										</p>
									</div>
								</li>
							))}
						</ul>
						<div className="flex flex-col items-start gap-2 sm:col-span-2 lg:col-span-1 lg:items-end">
							<Link
								href="/login"
								className={`mkt-cta inline-flex items-center gap-2 rounded-full bg-surface-0 px-5 py-3 text-sm font-medium text-foreground hover:bg-surface-2 ${display}`}
							>
								{t.free.cta}
							</Link>
							<p className={`max-w-[28ch] text-xs text-foreground-subtle lg:text-right ${body}`}>
								{t.free.footnote}
							</p>
						</div>
					</article>
				</div>
			</div>
		</section>
	);
}
