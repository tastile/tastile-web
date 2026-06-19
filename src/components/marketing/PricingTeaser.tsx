"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import type { Dict, Lang } from "./LandingPage";

type Interval = "monthly" | "yearly";

export function PricingTeaser({ t, lang }: { t: Dict["pricing"]; lang: Lang }) {
	const [interval, setInterval] = useState<Interval>("monthly");
	const isJa = lang === "ja";
	const display = isJa
		? "font-[family-name:var(--font-zen-kaku)]"
		: "font-[family-name:var(--font-outfit)]";
	const body = isJa ? "font-[family-name:var(--font-jp)]" : "";
	const mono = "font-[family-name:var(--font-geist-mono)]";

	return (
		<section className="relative overflow-hidden border-t border-surface-2 py-24 lg:py-32">
			{/* Background giant numeral. */}
			<div
				aria-hidden
				className="pointer-events-none absolute top-12 right-[-2rem] z-0 select-none"
			>
				<p className={`mkt-giant-numeral ${mono}`}>04</p>
			</div>

			<div className="layout-shell relative z-10">
				<header className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:items-end">
					<div>
						<p className="text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-muted">
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

				{/* Interval toggle. */}
				<div className="mt-12 flex justify-center">
					<div
						role="tablist"
						aria-label="Billing interval"
						className="inline-flex items-center rounded-full border border-surface-2 bg-surface-0 p-1 text-sm"
					>
						{(["monthly", "yearly"] as const).map((value) => {
							const isActive = interval === value;
							return (
								<button
									key={value}
									type="button"
									role="tab"
									aria-selected={isActive}
									onClick={() => setInterval(value)}
									className={[
										"mkt-cta rounded-full px-4 py-2 font-medium",
										isActive
											? "bg-foreground text-background"
											: "text-foreground-muted hover:text-foreground",
									].join(" ")}
								>
									{value === "monthly" ? t.monthly : t.yearly}
									{value === "yearly" ? (
										<span className="ml-2 text-[11px] font-normal text-foreground-subtle">
											{t.yearlyNote}
										</span>
									) : null}
								</button>
							);
						})}
					</div>
				</div>

				{/* Pricing as stacked horizontal bands, not parallel cards. */}
				<div className="mt-16">
					{/* Free band. */}
					<article className="mkt-price-band grid gap-8 lg:grid-cols-[10rem_1fr_2fr_auto] lg:items-center lg:gap-12">
						<div>
							<p className={`text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-muted ${display}`}>
								01 / {t.free.name}
							</p>
							<p className={`mt-3 text-5xl font-semibold leading-none tracking-tight text-foreground lg:text-6xl ${display}`}>
								{t.free.price}
							</p>
						</div>
						<div>
							<p className={`text-[11px] font-medium uppercase tracking-[0.18em] text-foreground-subtle ${display}`}>
								{isJa ? "対象" : "For"}
							</p>
							<p className={`mt-2 text-base text-foreground-muted ${body}`}>
								{t.free.tagline}
							</p>
						</div>
						<ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
							{t.free.features.map((feature) => (
								<li
									key={feature.title}
									className="flex items-start gap-3"
								>
									<span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground-muted/15 text-foreground-muted">
										<Check className="h-2.5 w-2.5" strokeWidth={2.5} />
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
						<div className="flex flex-col items-start gap-2 lg:items-end">
							<Link
								href="/login"
								className={`mkt-cta inline-flex items-center gap-2 rounded-full border border-surface-2 bg-surface-0 px-5 py-3 text-sm font-medium text-foreground hover:bg-surface-2 ${display}`}
							>
								{t.free.cta}
							</Link>
							<p className={`max-w-[28ch] text-xs text-foreground-subtle lg:text-right ${body}`}>
								{t.free.footnote}
							</p>
						</div>
					</article>

					{/* Pro band — emphasized with subtle primary tint. */}
					<article className="mkt-price-band mkt-price-band-pro grid gap-8 lg:grid-cols-[10rem_1fr_2fr_auto] lg:items-center lg:gap-12">
						<div>
							<div className="flex items-center gap-2">
								<p className={`text-[11px] font-medium uppercase tracking-[0.22em] text-primary ${display}`}>
									02 / {t.pro.name}
								</p>
								<span className={`rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-fg ${display}`}>
									{t.pro.badge}
								</span>
							</div>
							<p className={`mt-3 flex items-baseline gap-2 text-5xl font-semibold leading-none tracking-tight text-foreground lg:text-6xl ${display}`}>
								{interval === "monthly" ? "$5" : "$50"}
								<span className="text-base font-normal text-foreground-muted">
									/{interval === "monthly" ? "mo" : "yr"}
								</span>
							</p>
						</div>
						<div>
							<p className={`text-[11px] font-medium uppercase tracking-[0.18em] text-primary ${display}`}>
								{isJa ? "対象" : "For"}
							</p>
							<p className={`mt-2 text-base text-foreground ${body}`}>
								{t.pro.tagline}
							</p>
						</div>
						<ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
							{t.pro.features.map((feature) => (
								<li
									key={feature.title}
									className="flex items-start gap-3"
								>
									<span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
										<Check className="h-2.5 w-2.5" strokeWidth={2.5} />
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
						<div className="flex flex-col items-start gap-2 lg:items-end">
							<Link
								href="/pricing"
								className={`mkt-cta inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-interactive-hover ${display}`}
							>
								{t.pro.cta}
								<ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
							</Link>
							<p className={`max-w-[28ch] text-xs text-foreground-muted lg:text-right ${body}`}>
								{t.pro.footnote}
							</p>
						</div>
					</article>
				</div>
			</div>
		</section>
	);
}
