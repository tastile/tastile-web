import { ArrowUpRight } from "lucide-react";
import { ProductPreview } from "./ProductPreview";
import type { Dict, Lang } from "./LandingPage";

export function Hero({ t, lang }: { t: Dict["hero"]; lang: Lang }) {
	const isJa = lang === "ja";
	const display = isJa
		? "font-[family-name:var(--font-zen-kaku)]"
		: "font-[family-name:var(--font-outfit)]";
	const body = isJa ? "font-[family-name:var(--font-jp)]" : "";
	const mono = "font-[family-name:var(--font-geist-mono)]";

	return (
		<section className="layout-shell relative overflow-hidden pt-12 pb-32 lg:pt-16 lg:pb-48">
			{/* Piercing type — bleeds across the hero. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-[28%] z-0 mkt-bleed-in select-none overflow-hidden"
			>
				<p
					className={`mkt-pierce-stroke ${display} whitespace-nowrap text-center opacity-90`}
				>
					{t.pierceText}
				</p>
			</div>

			{/* Background giant numeral "00". */}
			<div
				aria-hidden
				className="pointer-events-none absolute -top-12 right-[-3rem] z-0 select-none"
			>
				<p className={`mkt-giant-numeral ${mono}`}>00</p>
			</div>

			<div className="relative z-10 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:items-start">
				<div>
					<p className="mkt-anim mkt-anim-1 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-muted">
						<span className="mkt-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
						{t.badge}
					</p>
					<h1
						className={`mkt-anim mkt-anim-2 mt-8 mkt-display-1 text-foreground ${display}`}
					>
						<span className="block">{t.title[0]}</span>
						<span className="block">{t.title[1]}</span>
					</h1>
					<p
						className={`mkt-anim mkt-anim-3 mt-8 max-w-[44ch] text-lg leading-relaxed text-foreground-muted ${body}`}
					>
						{t.sub}
					</p>
					<p
						className={`mkt-anim mkt-anim-3 mt-4 max-w-[52ch] text-base leading-relaxed text-foreground-subtle ${body}`}
					>
						{t.context}
					</p>

					<div className="mkt-anim mkt-anim-4 mt-10 flex flex-wrap items-center gap-3">
						<a
							href={t.ctaPrimaryHref}
							className={`mkt-cta inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-interactive-hover ${display}`}
						>
							{t.ctaPrimary}
							<ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
						</a>
						<a
							href={t.ctaSecondaryHref}
							className={`mkt-cta inline-flex items-center gap-2 rounded-full border border-surface-2 bg-surface-0 px-5 py-3 text-sm font-medium text-foreground hover:bg-surface-2 ${display}`}
						>
							{t.ctaSecondary}
						</a>
					</div>
				</div>

				{/* Product preview overflows downward into the next section. */}
				<div className="mkt-anim mkt-anim-3 relative">
					<div className="mkt-bleed-down">
						<ProductPreview t={t} lang={lang} />
					</div>
				</div>
			</div>

			{/* Stats strip — full width, hairline rule above. */}
			<div className="relative z-10 mt-24 border-t border-surface-2 pt-10 lg:mt-32">
				<dl className="grid grid-cols-1 gap-8 sm:grid-cols-3">
					{t.stats.map((stat, i) => (
						<div key={stat.label} className="flex flex-col gap-1">
							<dt
								className={`text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-subtle ${display}`}
							>
								{String(i + 1).padStart(2, "0")} / {stat.label}
							</dt>
							<dd
								className={`mkt-display-2 text-foreground ${display} ${isJa ? "" : "tabular-nums"}`}
							>
								{stat.value}
							</dd>
							<dd
								className={`text-sm text-foreground-muted ${body}`}
							>
								{stat.sub}
							</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}
