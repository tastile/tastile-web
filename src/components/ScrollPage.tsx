"use client";

import { Calendar, Clock, ListTodo } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useRef } from "react";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { easeOut, lerp, mapRange } from "@/lib/animate";

function op(p: number, s: number, e: number) {
  return easeOut(mapRange(p, s, e));
}
function ty(p: number, s: number, e: number, px = 40) {
  return lerp(px, 0, easeOut(mapRange(p, s, e)));
}

type Dict = {
  heroBadge: string;
  heroTitle: readonly string[];
  heroDesc: string;
  heroCta1: string;
  heroCta2: string;
  bridgeTitle: string;
  bridgeDesc: string;
  howTitle: string;
  howPrinciples: readonly {
    symbol: string;
    text: { ja: string; en: string };
  }[];
  howPipeline: { ja: string; en: string };
  stepsTitle: string;
  steps: readonly { icon: string; label: string; body?: string }[];
  lifeTitle: string;
  lifeLines: readonly string[];
  pricingTitle: string;
  pricingBody: string;
  qaTitle: string;
  qa: readonly { q: string; a: string }[];
  ctaTitle: readonly string[];
  ctaBody: string;
  ctaCta1: string;
  ctaCta2: string;
};

const apps = [
  {
    icon: <Calendar className="w-8 h-8" />,
    name: { ja: "カレンダー", en: "Calendar" },
    strength: { ja: "「いつ」を可視化", en: "Visualizes 'when'" },
    gap: { ja: "中身は知らない", en: "Doesn't know content" },
  },
  {
    icon: <Clock className="w-8 h-8" />,
    name: { ja: "時計", en: "Clock" },
    strength: { ja: "「今」を動かす", en: "Moves 'now'" },
    gap: { ja: "何をやるか知らない", en: "Doesn't know what" },
  },
  {
    icon: <ListTodo className="w-8 h-8" />,
    name: { ja: "タスク管理", en: "Tasks" },
    strength: { ja: "残りを見る", en: "Shows what's left" },
    gap: { ja: "いつやるか委ねられる", en: "When is up to you" },
  },
];

export function ScrollPage({
  t,
  stepIcons,
  lang,
}: {
  t: Dict;
  stepIcons: ReactNode[];
  lang: string;
}) {
  const L = lang as "ja" | "en";

  return (
    <div className="bg-background text-foreground">
      {/* ═══ LAYER 1: Hero — title stays, mock UI scrolls away ═══ */}
      <div className="relative" style={{ minHeight: "250vh" }}>
        {/* Sticky hero text — stays visible while mock scrolls */}
        <div className="sticky top-0 h-dvh flex items-center z-10">
          <div className="layout-shell w-full">
            <div className="max-w-[600px]">
              <span className="mb-6 inline-block rounded-full bg-surface-0 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground-subtle">
                {t.heroBadge}
              </span>
              <h1 className="font-[family-name:var(--font-jp-heading)] text-5xl font-semibold leading-[1.1] tracking-tight text-foreground lg:text-7xl">
                {t.heroTitle.map((l, i) => (
                  <span key={`hero-${i}`} className="block">
                    {l}
                  </span>
                ))}
              </h1>
              <p className="mt-8 max-w-[480px] text-lg leading-relaxed text-foreground-muted">
                {t.heroDesc}
              </p>
              <div className="mt-12 flex flex-wrap gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-sm font-medium text-background transition-colors duration-150 hover:bg-interactive-hover"
                >
                  {t.heroCta1}
                </Link>
                <Link
                  href="/download"
                  className="inline-flex items-center gap-2 rounded-full bg-surface-0 px-8 py-3.5 text-sm font-medium text-foreground-muted transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
                >
                  {t.heroCta2}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Mock UI — scrolls UP past the sticky hero */}
        <div className="absolute top-0 right-0 w-full h-full pointer-events-none z-20">
          <MockUIScroll lang={lang} stepIcons={stepIcons} />
        </div>
      </div>

      {/* ═══ LAYER 2: Apps — cards scroll in over blank space ═══ */}
      <div className="relative z-30">
        <AppsReveal lang={L} />
      </div>

      {/* ═══ LAYER 3: Bridge — text fades in centered ═══ */}
      <div className="relative z-30">
        <BridgeReveal t={t} />
      </div>

      {/* ═══ LAYER 4: How — principles reveal over pipeline ═══ */}
      <div className="relative z-30">
        <HowReveal t={t} lang={L} />
      </div>

      {/* ═══ LAYER 5: Cycle ═══ */}
      <div className="relative z-30">
        <CycleReveal t={t} />
      </div>

      {/* ═══ LAYER 6: Life ═══ */}
      <div className="relative z-30">
        <LifeReveal t={t} />
      </div>

      {/* ═══ LAYER 7: Pricing ═══ */}
      <div className="relative z-30">
        <PricingReveal t={t} lang={L} />
      </div>

      {/* ═══ LAYER 8: Q&A ═══ */}
      <div className="relative z-30">
        <QAReveal t={t} />
      </div>

      {/* ═══ LAYER 9: CTA ═══ */}
      <div className="relative z-30">
        <CTAReveal t={t} />
      </div>
    </div>
  );
}

/* ─── Mock UI: scrolls diagonally up-right past the hero ─── */
function MockUIScroll({ lang, stepIcons }: { lang: string; stepIcons: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);

  return (
    <div ref={ref} className="h-[250vh]">
      <div className="sticky top-0 h-dvh flex items-center justify-end pr-16">
        <div
          className="w-[420px]"
          style={{
            opacity: op(p, 0, 0.6),
            transform: `translateY(${lerp(80, -200, easeOut(mapRange(p, 0, 0.8)))}px) scale(${lerp(0.92, 1, easeOut(mapRange(p, 0, 0.4)))})`,
          }}
        >
          <div className="rounded-2xl bg-surface-elevated p-6 shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
                {stepIcons[0]}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
                {stepIcons[1]}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
                {stepIcons[2]}
              </span>
            </div>
            <div className="rounded-xl bg-surface-2 p-5">
              <div className="flex items-start gap-4">
                <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-success flex-none" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {lang === "ja"
                      ? "競合調査レポートをまとめる"
                      : "Write competitive analysis report"}
                  </p>
                  <p className="mt-1.5 text-xs text-foreground-subtle">
                    {lang === "ja" ? "14:00 — 15:30 · 90分" : "2:00 PM — 3:30 PM · 90 min"}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-surface-1 p-4 opacity-50">
              <div className="flex items-start gap-4">
                <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-foreground-subtle" />
                <div>
                  <p className="text-sm font-medium text-foreground-muted">
                    {lang === "ja" ? "週次レビューのスライド作成" : "Create weekly review slides"}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground-subtle">
                    {lang === "ja" ? "16:00 — 17:00 · 60分" : "4:00 PM — 5:00 PM · 60 min"}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-foreground-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              {lang === "ja" ? "実行中" : "Executing"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Apps: 3 cards stagger in from below ─── */
function AppsReveal({ lang }: { lang: "ja" | "en" }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);

  return (
    <div ref={ref} className="relative py-32" style={{ minHeight: "300vh" }}>
      <div className="sticky top-0 h-dvh flex items-center">
        <div className="layout-shell w-full">
          {/* Title */}
          <h2
            className="font-[family-name:var(--font-jp-heading)] mb-16 text-3xl font-semibold tracking-tight text-foreground lg:text-4xl"
            style={{ opacity: op(p, 0, 0.08) }}
          >
            {lang === "ja" ? "既存アプリの問題" : "The problem with existing apps"}
          </h2>

          {/* Cards — each at different depth */}
          <div className="flex justify-center gap-8 max-w-4xl mx-auto">
            {apps.map((app, i) => {
              const s = 0.06 + i * 0.08;
              const e = s + 0.14;
              const depth = [0, 1, 2][i]; // 0=front, 2=back
              return (
                <div
                  key={app.name.en}
                  className="flex-1 rounded-2xl bg-surface-elevated p-8 text-center"
                  style={{
                    opacity: op(p, s, e),
                    transform: `translateY(${ty(p, s, e, 50 + depth * 10)}px) scale(${lerp(0.9, 1, easeOut(mapRange(p, s, e)))})`,
                    zIndex: 3 - depth,
                  }}
                >
                  <div className="flex justify-center mb-4 text-foreground-muted">{app.icon}</div>
                  <p className="text-base font-semibold text-foreground">{app.name[lang]}</p>
                  <p className="mt-2 text-sm text-foreground-muted">{app.strength[lang]}</p>
                  <p className="mt-3 text-sm text-foreground-subtle">{app.gap[lang]}</p>
                </div>
              );
            })}
          </div>

          {/* Cut symbol */}
          <div className="text-center mt-16" style={{ opacity: op(p, 0.42, 0.52) }}>
            <span className="text-4xl text-foreground-subtle tracking-[0.6em]">✂ ✂ ✂</span>
            <p className="mt-4 text-base text-foreground-subtle">
              {lang === "ja" ? "どれも独立している" : "All separate"}
            </p>
          </div>

          {/* Connection diagram — scales in */}
          <div
            className="flex justify-center items-center gap-5 max-w-4xl mx-auto mt-16"
            style={{
              opacity: op(p, 0.58, 0.75),
              transform: `scale(${lerp(0.85, 1, easeOut(mapRange(p, 0.58, 0.75)))})`,
            }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-foreground-muted">
              <Calendar className="w-7 h-7" />
            </div>
            <span className="text-foreground-subtle text-2xl font-light">+</span>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-foreground-muted">
              <Clock className="w-7 h-7" />
            </div>
            <span className="text-foreground-subtle text-2xl font-light">+</span>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-foreground-muted">
              <ListTodo className="w-7 h-7" />
            </div>
            <span className="text-foreground-subtle text-2xl font-light">=</span>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-background font-bold text-xl">
              T
            </div>
          </div>

          <p
            className="text-center mt-8 text-base text-foreground-muted max-w-lg mx-auto"
            style={{ opacity: op(p, 0.72, 0.85) }}
          >
            {lang === "ja"
              ? "積み残しが生まれる。書き損ねたアイデア。つながっていれば、それらは行動に繋がっているはずだ。"
              : "Backlog builds up. Ideas you never captured. If connected, those would become action."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Bridge ─── */
function BridgeReveal({ t }: { t: Dict }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);

  return (
    <div ref={ref} className="relative py-32" style={{ minHeight: "200vh" }}>
      <div className="sticky top-0 h-dvh flex items-center justify-center">
        <div className="text-center max-w-2xl px-8">
          <h2
            className="font-[family-name:var(--font-jp-heading)] text-3xl font-semibold tracking-tight text-foreground lg:text-5xl"
            style={{
              opacity: op(p, 0.1, 0.35),
              transform: `translateY(${ty(p, 0.1, 0.35, 30)}px)`,
            }}
          >
            {t.bridgeTitle}
          </h2>
          <p
            className="mt-8 text-lg text-foreground-muted leading-relaxed"
            style={{
              opacity: op(p, 0.25, 0.5),
              transform: `translateY(${ty(p, 0.25, 0.5, 20)}px)`,
            }}
          >
            {t.bridgeDesc}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── How: pipeline scrolls in, then principles stack below ─── */
function HowReveal({ t, lang }: { t: Dict; lang: "ja" | "en" }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);

  return (
    <div ref={ref} className="relative py-32" style={{ minHeight: "350vh" }}>
      <div className="sticky top-0 h-dvh flex items-center">
        <div className="layout-shell w-full">
          <h2
            className="font-[family-name:var(--font-jp-heading)] mb-12 text-center text-3xl font-semibold tracking-tight text-foreground lg:text-4xl"
            style={{ opacity: op(p, 0, 0.08) }}
          >
            {t.howTitle}
          </h2>

          {/* Pipeline — slides from left */}
          <div
            className="flex justify-center items-center gap-3 mb-16 flex-wrap"
            style={{
              opacity: op(p, 0.04, 0.16),
              transform: `translateX(${lerp(-40, 0, easeOut(mapRange(p, 0.04, 0.16)))}px)`,
            }}
          >
            {t.howPipeline[lang].split(" → ").map((step, i, arr) => (
              <span key={i} className="flex items-center gap-3">
                <span className="rounded-xl bg-surface-elevated px-5 py-2.5 text-sm font-medium text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  {step}
                </span>
                {i < arr.length - 1 && <span className="text-foreground-subtle text-lg">→</span>}
              </span>
            ))}
          </div>

          {/* Principles — each deeper than the last */}
          <div className="max-w-2xl mx-auto space-y-8">
            {t.howPrinciples.map((item, i) => {
              const s = 0.14 + i * 0.2;
              const e = s + 0.16;
              return (
                <div
                  key={i}
                  className="flex items-start gap-5"
                  style={{
                    opacity: op(p, s, e),
                    transform: `translateY(${ty(p, s, e, 30)}px) translateX(${lerp(-20, 0, easeOut(mapRange(p, s, e)))}px)`,
                  }}
                >
                  <span className="text-3xl text-foreground-subtle flex-none mt-0.5">
                    {item.symbol}
                  </span>
                  <p className="text-base text-foreground-muted leading-relaxed">
                    {item.text[lang]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Cycle ─── */
function CycleReveal({ t }: { t: Dict }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);

  return (
    <div ref={ref} className="relative py-32" style={{ minHeight: "250vh" }}>
      <div className="sticky top-0 h-dvh flex items-center">
        <div className="layout-shell w-full">
          <h2
            className="font-[family-name:var(--font-jp-heading)] mb-12 text-center text-3xl font-semibold tracking-tight text-foreground lg:text-4xl"
            style={{ opacity: op(p, 0.03, 0.1) }}
          >
            {t.stepsTitle}
          </h2>
          <div className="flex justify-center items-center gap-8 max-w-3xl mx-auto">
            {t.steps.map((step, i) => {
              const s = 0.06 + i * 0.14;
              const e = s + 0.12;
              const isArrow = step.icon === "→";
              return (
                <div
                  key={i}
                  className="flex items-center"
                  style={{
                    opacity: op(p, s, e),
                    transform: `translateY(${ty(p, s, e, 24)}px) scale(${lerp(0.88, 1, easeOut(mapRange(p, s, e)))})`,
                  }}
                >
                  {isArrow ? (
                    <span className="text-3xl text-foreground-subtle mx-1">→</span>
                  ) : (
                    <div className="text-center">
                      <div className="text-5xl mb-3">{step.icon}</div>
                      <p className="text-sm font-semibold text-foreground">{step.label}</p>
                      {step.body && (
                        <p className="mt-1 text-xs text-foreground-muted">{step.body}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Life ─── */
function LifeReveal({ t }: { t: Dict }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);

  return (
    <div ref={ref} className="relative py-32" style={{ minHeight: "250vh" }}>
      <div className="sticky top-0 h-dvh flex items-center justify-center">
        <div className="text-center max-w-xl px-8">
          <h2
            className="font-[family-name:var(--font-jp-heading)] mb-12 text-3xl font-semibold tracking-tight text-foreground lg:text-4xl"
            style={{ opacity: op(p, 0.03, 0.1) }}
          >
            {t.lifeTitle}
          </h2>
          <div className="space-y-8">
            {t.lifeLines.map((line, i) => {
              const s = 0.06 + i * 0.2;
              const e = s + 0.15;
              return (
                <p
                  key={i}
                  className="text-center text-lg text-foreground-muted"
                  style={{
                    opacity: op(p, s, e),
                    transform: `translateY(${ty(p, s, e, 16)}px)`,
                  }}
                >
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pricing ─── */
function PricingReveal({ t, lang }: { t: Dict; lang: "ja" | "en" }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);

  return (
    <div ref={ref} className="relative py-32" style={{ minHeight: "200vh" }}>
      <div className="sticky top-0 h-dvh flex items-center justify-center">
        <div className="text-center max-w-lg px-8">
          <h2
            className="font-[family-name:var(--font-jp-heading)] mb-4 text-3xl font-semibold tracking-tight text-foreground lg:text-4xl"
            style={{
              opacity: op(p, 0.05, 0.25),
              transform: `translateY(${ty(p, 0.05, 0.25, 20)}px)`,
            }}
          >
            {t.pricingTitle}
          </h2>
          <p
            className="text-lg text-foreground-muted"
            style={{
              opacity: op(p, 0.12, 0.35),
              transform: `translateY(${ty(p, 0.12, 0.35, 16)}px)`,
            }}
          >
            {t.pricingBody}
          </p>
          <div
            className="mt-10"
            style={{
              opacity: op(p, 0.25, 0.45),
              transform: `translateY(${ty(p, 0.25, 0.45, 12)}px)`,
            }}
          >
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-10 py-4 text-sm font-medium text-background transition-colors duration-150 hover:bg-interactive-hover"
            >
              {lang === "ja" ? "料金プランを見る" : "View Pricing"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Q&A ─── */
function QAReveal({ t }: { t: Dict }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);

  return (
    <div ref={ref} className="relative py-32" style={{ minHeight: "300vh" }}>
      <div className="sticky top-0 h-dvh flex items-center">
        <div className="layout-shell max-w-2xl w-full">
          <h2
            className="font-[family-name:var(--font-jp-heading)] mb-10 text-center text-3xl font-semibold tracking-tight text-foreground lg:text-4xl"
            style={{ opacity: op(p, 0.03, 0.08) }}
          >
            {t.qaTitle}
          </h2>
          <div className="space-y-3">
            {t.qa.map((item, i) => {
              const s = 0.05 + i * 0.2;
              const e = s + 0.12;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl bg-surface-elevated px-7 py-6"
                  style={{
                    opacity: op(p, s, e),
                    transform: `translateY(${ty(p, s, e, 20)}px)`,
                  }}
                >
                  <h3 className="text-base font-semibold text-foreground">{item.q}</h3>
                  <p className="mt-2 text-sm text-foreground-muted leading-relaxed">{item.a}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CTA ─── */
function CTAReveal({ t }: { t: Dict }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);

  return (
    <div ref={ref} className="relative py-32" style={{ minHeight: "200vh" }}>
      <div className="sticky top-0 h-dvh flex items-center justify-center">
        <div className="text-center max-w-3xl px-8">
          <h2
            className="font-[family-name:var(--font-jp-heading)] text-4xl font-semibold leading-tight tracking-tight text-foreground lg:text-6xl"
            style={{ opacity: op(p, 0.08, 0.35) }}
          >
            {t.ctaTitle.map((l, i) => (
              <span
                key={i}
                className="block"
                style={{
                  opacity: op(p, 0.1 + i * 0.08, 0.35 + i * 0.08),
                  transform: `translateY(${ty(p, 0.1 + i * 0.08, 0.35 + i * 0.08, 20)}px)`,
                }}
              >
                {l}
              </span>
            ))}
          </h2>
          <p
            className="mt-8 text-lg text-foreground-muted"
            style={{
              opacity: op(p, 0.3, 0.5),
              transform: `translateY(${ty(p, 0.3, 0.5, 16)}px)`,
            }}
          >
            {t.ctaBody}
          </p>
          <div
            className="mt-12 flex justify-center flex-wrap gap-4"
            style={{
              opacity: op(p, 0.38, 0.58),
              transform: `translateY(${ty(p, 0.38, 0.58, 12)}px)`,
            }}
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-10 py-4 text-sm font-medium text-background transition-colors duration-150 hover:bg-interactive-hover"
            >
              {t.ctaCta1}
            </Link>
            <Link
              href="/download"
              className="inline-flex items-center gap-2 rounded-full bg-surface-0 px-10 py-4 text-sm font-medium text-foreground-muted transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
            >
              {t.ctaCta2}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
