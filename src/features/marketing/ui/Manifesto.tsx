import { Circle } from "lucide-react";
import type { Dict, Lang } from "./LandingPage";

export function Manifesto({ t, lang }: { t: Dict["manifesto"]; lang: Lang }) {
  const isJa = lang === "ja";
  const display = isJa
    ? "font-[family-name:var(--font-zen-kaku)]"
    : "font-[family-name:var(--font-outfit)]";
  const body = isJa ? "font-[family-name:var(--font-jp)]" : "";
  const mono = "font-[family-name:var(--font-geist-mono)]";

  const kindColor: Record<string, string> = {
    tile: "text-foreground",
    adjust: "text-primary",
    overflow: "text-primary",
    break: "text-foreground-muted",
  };

  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      {/* Background giant numeral. */}
      <div aria-hidden className="pointer-events-none absolute top-12 left-[-2rem] z-0 select-none">
        <p className={`mkt-giant-numeral ${mono}`}>03</p>
      </div>

      <div className="layout-shell relative z-10">
        <header className="max-w-3xl">
          <p className="text-caption font-medium uppercase tracking-[0.22em] text-foreground-muted">
            {t.eyebrow}
          </p>
          <h2 className={`mt-3 mkt-display-2 text-foreground ${display}`}>
            <span className="block">{t.title[0]}</span>
            <span className="block text-primary">{t.title[1]}</span>
          </h2>
          <p className={`mt-6 max-w-[64ch] text-lg leading-relaxed text-foreground-muted ${body}`}>
            {t.lead}
          </p>
        </header>

        {/* Comparison: two stacked full-width blocks, not parallel cards. */}
        <div className="mt-16">
          {/* Left — old way. */}
          <div className="grid gap-6 pb-12 lg:grid-cols-[10rem_1fr] lg:gap-12">
            <div className="flex items-start gap-3">
              <span className={`${mono} text-sm text-foreground-subtle tabular-nums`}>
                {t.oldLabel}
              </span>
              <span className={`${mono} text-sm text-foreground-subtle tabular-nums`}>
                {t.oldCount}
              </span>
            </div>
            <div>
              <p
                className={`text-caption font-medium uppercase tracking-[0.22em] text-foreground-subtle ${display}`}
              >
                {t.leftLabel}
              </p>
              <ul className="mt-6 space-y-3">
                {t.leftItems.map((item) => (
                  <li
                    key={item}
                    className={`flex items-center gap-3 text-base text-foreground-muted ${body}`}
                  >
                    <Circle
                      className="h-3.5 w-3.5 shrink-0 text-foreground-subtle"
                      strokeWidth={1.5}
                    />
                    <span className="line-through decoration-foreground-subtle/40">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right — Tastile. Active, primary accent, no card border but emphasized. */}
          <div className="grid gap-6 pt-12 lg:grid-cols-[10rem_1fr] lg:gap-12">
            <div className="flex items-start gap-3">
              <span className={`${mono} text-sm text-primary tabular-nums`}>{t.newLabel}</span>
              <span className="mkt-pulse-dot inline-block h-2 w-2 translate-y-1.5 rounded-full bg-primary" />
            </div>
            <div>
              <p
                className={`text-caption font-medium uppercase tracking-[0.22em] text-primary ${display}`}
              >
                {t.rightLabel}
              </p>
              <p className={`mt-6 mkt-pullquote text-foreground ${display}`}>{t.rightHeadline}</p>
              <p
                className={`mt-3 max-w-[60ch] text-base leading-relaxed text-foreground-muted ${body}`}
              >
                {t.rightSubtext}
              </p>

              {/* Live execution card — not a "card", but a live data strip. */}
              <div className="mt-8 bg-surface-2 pl-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={`${mono} text-caption text-foreground-muted`}>
                    {t.liveAtPrefix}
                    {t.liveAtDuration}
                  </span>
                  <span className={`${mono} text-caption uppercase tracking-[0.22em] text-primary`}>
                    {t.timelineKindLabel}
                  </span>
                </div>
                <p className={`mt-2 text-lg font-semibold text-foreground ${display}`}>
                  {t.timelineLiveTitle}
                </p>
                <div className="mt-3 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full w-[58%] rounded-full bg-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline section. */}
        <div className="mt-24 grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <h3 className={`mkt-display-2 text-foreground ${display}`}>{t.timelineTitle}</h3>
            <p
              className={`mt-4 max-w-[40ch] text-base leading-relaxed text-foreground-muted ${body}`}
            >
              {t.timelineSubtitle}
            </p>
          </div>
          <ol className="mkt-timeline relative">
            {t.timeline.map((event) => (
              <li
                key={`${event.time}-${event.title}`}
                className="relative grid grid-cols-[5.5rem_1fr] gap-6 py-7"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className={`${mono} text-sm text-foreground ${isJa ? "" : "tabular-nums"}`}>
                    {event.time}
                  </span>
                  <span
                    className={`${mono} text-caption uppercase tracking-[0.18em] ${kindColor[event.kind] ?? "text-foreground-muted"}`}
                  >
                    {event.kind.toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className={`text-lg font-semibold text-foreground ${display}`}>
                    {event.title}
                  </p>
                  <p className={`mt-1.5 text-sm leading-relaxed text-foreground-muted ${body}`}>
                    {event.note}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
