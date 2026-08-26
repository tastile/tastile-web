import type { Dict, Lang } from "./LandingPage";

export function ConditionBento({ t, lang }: { t: Dict["bento"]; lang: Lang }) {
  const isJa = lang === "ja";
  const display = isJa
    ? "font-[family-name:var(--font-zen-kaku)]"
    : "font-[family-name:var(--font-outfit)]";
  const body = isJa ? "font-[family-name:var(--font-jp)]" : "";
  const mono = "font-[family-name:var(--font-geist-mono)]";

  return (
    <section className="relative overflow-hidden bg-background pt-10 pb-20 lg:pt-24 lg:pb-32">
      {/* Background giant numeral. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-12 left-[-1rem] z-0 select-none lg:left-[-2rem] lg:top-16"
      >
        <p className={`mkt-giant-numeral ${mono}`}>01</p>
      </div>

      <div className="layout-shell relative z-10">
        <header className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-muted">
              {t.eyebrow}
            </p>
            <h2 className={`mt-3 mkt-display-2 text-foreground ${display}`}>{t.title}</h2>
          </div>
          <div className="lg:pb-2">
            <p className={`max-w-[56ch] text-lg leading-relaxed text-foreground-muted ${body}`}>
              {t.intro}
            </p>
            <p
              className={`mt-3 max-w-[60ch] text-base leading-relaxed text-foreground-subtle ${body}`}
            >
              {t.lead}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className={`mkt-rule-short ${mono}`} />
              <span
                className={`text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-muted ${display}`}
              >
                {t.axisLabel}
              </span>
            </div>
          </div>
        </header>

        {/* Rows — no card chrome, just hairline rules. */}
        <div className="mt-12 lg:mt-16">
          {t.rows.map((row) => (
            <article
              key={row.numeral}
              className="mkt-condition-row grid grid-cols-1 gap-6 sm:grid-cols-[3rem_1fr] lg:grid-cols-[6rem_1fr_1.4fr] lg:gap-12"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mkt-row-numeral ${mono} text-sm text-foreground-subtle tabular-nums`}
                >
                  {row.numeral}
                </span>
                <span
                  className={`${mono} hidden h-px flex-1 translate-y-3 bg-surface-2 lg:block`}
                />
              </div>
              <div>
                <h3
                  className={`text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground lg:text-3xl ${display}`}
                >
                  {row.name}
                </h3>
                <p className={`mt-2 text-base font-medium text-foreground-muted ${display}`}>
                  {row.lede}
                </p>
              </div>
              <div>
                <p className={`text-base leading-relaxed text-foreground-muted ${body}`}>
                  {row.body}
                </p>
                <div className={`mt-4 bg-surface-2 pl-4 py-3 ${body}`}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                    {t.exampleLabel}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{row.example}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
