import type { Dict, Lang } from "./LandingPage";

const SIZE = 400;
const CENTER = SIZE / 2;
const RING_R = 130;
const NODE_R = 34;
const LABEL_R = 185;
const ACTIVE_INDEX = 3;

function polar(angleDeg: number, r: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + r * Math.cos(a),
    y: CENTER + r * Math.sin(a),
  };
}

function textAnchorFor(x: number) {
  if (x < CENTER - 20) return "end";
  if (x > CENTER + 20) return "start";
  return "middle";
}

export function LifecycleLoop({ t, lang }: { t: Dict["lifecycle"]; lang: Lang }) {
  const isJa = lang === "ja";
  const display = isJa
    ? "font-[family-name:var(--font-zen-kaku)]"
    : "font-[family-name:var(--font-outfit)]";
  const body = isJa ? "font-[family-name:var(--font-jp)]" : "";
  const mono = "font-[family-name:var(--font-geist-mono)]";
  const rootFont = isJa
    ? "var(--font-zen-kaku), var(--font-outfit)"
    : "var(--font-outfit), var(--font-zen-kaku)";

  return (
    <section className="relative overflow-hidden bg-surface-0 py-20 lg:py-32">
      {/* Background giant numeral. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-12 right-[-1rem] z-0 select-none lg:right-[-2rem]"
      >
        <p className={`mkt-giant-numeral ${mono}`}>02</p>
      </div>

      <div className="layout-shell relative z-10">
        <header className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:items-end">
          <div>
            <p className="text-caption font-medium uppercase tracking-[0.22em] text-foreground-muted">
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
              <span className="mkt-pulse-dot inline-block size-1.5 rounded-full bg-primary" />
              <span
                className={`text-caption font-medium uppercase tracking-[0.22em] text-primary ${display}`}
              >
                {t.activeLabel}
              </span>
            </div>
          </div>
        </header>

        {/* Loop + integrated phase descriptions — single composition, not card grid. */}
        <div className="mt-12 grid gap-12 sm:mt-16 lg:mt-20 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="relative mx-auto hidden w-full max-w-[420px] lg:block">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="h-auto w-full"
              style={{ fontFamily: rootFont }}
              role="img"
              aria-label={t.title}
            >
              <title>{t.title}</title>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RING_R}
                fill="none"
                stroke="var(--foreground-subtle)"
                strokeWidth="1"
                strokeDasharray="2 5"
              />
              <defs>
                {t.phases.map((_, i) => (
                  <marker
                    key={`marker-${i}`}
                    id={`arrow-${i}`}
                    viewBox="0 0 8 8"
                    refX="6"
                    refY="4"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--foreground-subtle)" opacity={0.45} />
                  </marker>
                ))}
              </defs>
              {t.phases.map((_, i) => {
                const next = (i + 1) % t.phases.length;
                const a1 = i * 60;
                const a2 = next * 60;
                const p1 = polar(a1, RING_R);
                const p2 = polar(a2, RING_R);
                const path = `M ${p1.x} ${p1.y} A ${RING_R} ${RING_R} 0 0 1 ${p2.x} ${p2.y}`;
                return (
                  <path
                    key={`arc-${i}`}
                    d={path}
                    fill="none"
                    stroke="var(--foreground-subtle)"
                    strokeOpacity={0.35}
                    strokeWidth="1"
                    markerEnd={`url(#arrow-${i})`}
                  />
                );
              })}
              <g className="mkt-loop-orbit" style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
                <circle cx={CENTER + RING_R} cy={CENTER} r="3.5" fill="var(--primary)" />
              </g>
              <text
                x={CENTER}
                y={CENTER + 5}
                textAnchor="middle"
                fontSize="11"
                letterSpacing="3"
                fill="var(--foreground-muted)"
                fontFamily="var(--font-geist-mono), monospace"
              >
                {t.activeLabel.toUpperCase()}
              </text>
              {t.phases.map((phase, i) => {
                const p = polar(i * 60, RING_R);
                const l = polar(i * 60, LABEL_R);
                const isActive = i === ACTIVE_INDEX;
                return (
                  <g key={phase}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={NODE_R}
                      fill={isActive ? "var(--primary)" : "var(--surface-elevated)"}
                      stroke={isActive ? "var(--primary)" : "var(--foreground-subtle)"}
                      strokeWidth="1.5"
                      className={isActive ? "mkt-loop-node-active" : ""}
                    />
                    <text
                      x={p.x}
                      y={p.y + 4}
                      textAnchor="middle"
                      fontSize="12"
                      fontFamily="var(--font-geist-mono), monospace"
                      fill={isActive ? "white" : "var(--foreground-muted)"}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </text>
                    <text
                      x={l.x}
                      y={l.y + 5}
                      textAnchor={textAnchorFor(l.x)}
                      fontSize="15"
                      fontWeight={isActive ? "700" : "500"}
                      fill={isActive ? "var(--foreground)" : "var(--foreground-muted)"}
                    >
                      {phase}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/12 blur-3xl"
            />
          </div>

          {/* Phase descriptions as a single flowing list, no card chrome. */}
          <ol className="mkt-timeline relative">
            {t.phaseDetails.map((phase, i) => (
              <li
                key={phase.title}
                className="relative grid grid-cols-[5rem_1fr] gap-6 py-8"
              >
                <div className="flex flex-col items-start">
                  <span className={`${mono} text-xs text-foreground-subtle tabular-nums`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`mt-2 inline-block size-2 rounded-full ${
                      i === ACTIVE_INDEX ? "bg-primary mkt-pulse-dot" : "bg-surface-2"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <h3
                    className={`text-xl font-semibold tracking-tight text-foreground lg:text-2xl ${display}`}
                  >
                    {phase.title}
                  </h3>
                  <p className={`mt-2 text-base leading-relaxed text-foreground-muted ${body}`}>
                    {phase.description}
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
