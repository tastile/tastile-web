import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";
import type { Dict, Lang } from "./LandingPage";

export function CtaSection({ t, lang }: { t: Dict["finalCta"]; lang: Lang }) {
  const isJa = lang === "ja";
  const display = isJa
    ? "font-[family-name:var(--font-zen-kaku)]"
    : "font-[family-name:var(--font-outfit)]";
  const body = isJa ? "font-[family-name:var(--font-jp)]" : "";
  const mono = "font-[family-name:var(--font-geist-mono)]";

  return (
    <section className="layout-shell relative overflow-hidden pt-24 pb-32 lg:pt-32 lg:pb-40">
      {/* Background giant numeral. */}
      <div aria-hidden className="pointer-events-none absolute top-12 left-[-2rem] z-0 select-none">
        <p className={`mkt-giant-numeral ${mono}`}>06</p>
      </div>

      {/* Piercing type. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[18%] z-0 mkt-bleed-in select-none overflow-hidden"
      >
        <p
          className={`mkt-pierce-stroke mkt-pierce-accent whitespace-nowrap text-center ${display}`}
        >
          {t.pierceText}
        </p>
      </div>

      <div className="relative z-10">
        <div className="max-w-3xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-muted">
            {t.startHereLabel}
          </p>
          <h2 className={`mt-4 mkt-display-1 text-foreground ${display}`}>
            <span className="block">{t.title[0]}</span>
            <span className="block text-primary">{t.title[1]}</span>
          </h2>
          <p className={`mt-6 max-w-[60ch] text-lg leading-relaxed text-foreground-muted ${body}`}>
            {t.note}
          </p>
        </div>

        {/* Promise list — vertical, not horizontal card. */}
        <ul className="mt-10 flex flex-col gap-3">
          {t.promise.map((p) => (
            <li key={p} className={`flex items-center gap-3 text-base text-foreground ${display}`}>
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {p}
            </li>
          ))}
        </ul>

        {/* CTAs. */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className={`mkt-cta inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-medium text-background hover:bg-interactive-hover ${display}`}
          >
            {t.ctaPrimary}
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
          <Link
            href="/download"
            className={`mkt-cta inline-flex items-center gap-2 rounded-full border border-surface-2 bg-surface-0 px-6 py-3.5 text-sm font-medium text-foreground hover:bg-surface-2 ${display}`}
          >
            {t.ctaSecondary}
          </Link>
        </div>

        {/* Footer micro-info. */}
        <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-surface-2 pt-6 text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-subtle">
          <span className={display}>{t.freeTierNote}</span>
          <span className={`${mono} text-foreground-muted`}>·</span>
          <span className={display}>{t.cancelNote}</span>
          <span className={`${mono} text-foreground-muted`}>·</span>
          <span className={display}>{t.platformNote}</span>
        </div>
      </div>
    </section>
  );
}
