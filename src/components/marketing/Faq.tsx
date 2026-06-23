import type { Dict, Lang } from "./LandingPage";

export function Faq({ t, lang }: { t: Dict["faq"]; lang: Lang }) {
  const isJa = lang === "ja";
  const display = isJa
    ? "font-[family-name:var(--font-zen-kaku)]"
    : "font-[family-name:var(--font-outfit)]";
  const body = isJa ? "font-[family-name:var(--font-jp)]" : "";
  const mono = "font-[family-name:var(--font-geist-mono)]";

  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      {/* Background giant numeral. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-12 right-[-2rem] z-0 select-none"
      >
        <p className={`mkt-giant-numeral ${mono}`}>05</p>
      </div>

      <div className="layout-shell relative z-10">
        <header className="max-w-3xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-muted">
            {t.eyebrow}
          </p>
          <h2 className={`mt-3 mkt-display-2 text-foreground ${display}`}>{t.title}</h2>
          <p className={`mt-5 max-w-[56ch] text-lg leading-relaxed text-foreground-muted ${body}`}>
            {t.intro}
          </p>
        </header>

        {/* FAQ with sticky giant "?" on the left + numbered list on the right. */}
        <div className="mt-16 grid gap-12 lg:grid-cols-[12rem_1fr] lg:gap-20">
          <div className="hidden lg:block">
            <p aria-hidden className="mkt-faq-marker select-none">
              ?
            </p>
            <div className="mt-8 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-foreground-muted">
              <span className={`${mono} tabular-nums`}>
                {String(t.items.length).padStart(2, "0")}
              </span>
              <span>{isJa ? "件の質問" : "questions"}</span>
            </div>
          </div>

          <ol className="mkt-timeline relative">
            {t.items.map((item, i) => (
              <li key={item.q} className="relative border-b border-surface-2 py-7 first:border-t">
                <div className="grid gap-3 sm:grid-cols-[4rem_1fr] sm:gap-6">
                  <div className="flex items-start gap-3">
                    <span className={`${mono} text-sm text-foreground-subtle tabular-nums`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`mt-2 inline-block h-2 w-2 rounded-full ${
                        i === 0 ? "bg-primary mkt-pulse-dot" : "bg-surface-2"
                      }`}
                    />
                  </div>
                  <div>
                    <details className="mkt-details group">
                      <summary className="flex items-start justify-between gap-6 text-left">
                        <span
                          className={`text-lg font-semibold text-foreground lg:text-xl ${display}`}
                        >
                          {item.q}
                        </span>
                      </summary>
                      <p
                        className={`mt-4 max-w-[64ch] text-base leading-relaxed text-foreground-muted ${body}`}
                      >
                        {item.a}
                      </p>
                    </details>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
