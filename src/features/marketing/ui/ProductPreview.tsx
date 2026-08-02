import { AlarmClock, Check, CheckCircle2, Circle, MapPin, Pause } from "lucide-react";
import type { Dict, Lang } from "./LandingPage";

export function ProductPreview({ t, lang }: { t: Dict["hero"]; lang: Lang }) {
  const isJa = lang === "ja";
  const display = isJa
    ? "font-[family-name:var(--font-zen-kaku)]"
    : "font-[family-name:var(--font-outfit)]";
  const body = isJa ? "font-[family-name:var(--font-jp)]" : "";
  const labels = t.previewAxisLabels;
  const activeAxes = new Set([0, 1]);

  return (
    <div className="relative">
      <div className="rounded-2xl border border-surface-2 bg-surface-elevated p-5 shadow-[0_18px_60px_-30px_rgba(17,18,23,0.18)] lg:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="mkt-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            <span
              className={`text-[11px] font-medium uppercase tracking-[0.18em] text-foreground-muted ${display}`}
            >
              {t.previewTodayLabel}
            </span>
          </div>
          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-foreground-subtle">
            4 / 7
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {labels.map((label, i) => {
            const isActive = activeAxes.has(i);
            return (
              <span
                key={label}
                className={[
                  "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium tracking-wide",
                  isActive ? "bg-primary/15 text-primary" : "bg-surface-0 text-foreground-subtle",
                  isJa ? "font-[family-name:var(--font-zen-kaku)]" : "",
                ].join(" ")}
              >
                {label}
              </span>
            );
          })}
        </div>

        <div className="mt-5 space-y-2">
          {t.previewTiles.map((tile, i) => {
            const isActive = tile.state === "active";
            const isDone = tile.state === "done";
            return (
              <div
                key={tile.title}
                className={[
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                  isActive
                    ? "border-primary/30 bg-primary/[0.06]"
                    : isDone
                      ? "border-surface-2 bg-surface-0 opacity-60"
                      : "border-surface-2 bg-surface-0",
                ].join(" ")}
                style={{ animationDelay: `${200 + i * 80}ms` }}
              >
                <div className="flex w-16 shrink-0 flex-col font-[family-name:var(--font-geist-mono)] text-[11px] leading-tight">
                  <span
                    className={
                      isDone
                        ? "text-foreground-subtle line-through"
                        : isActive
                          ? "text-foreground"
                          : "text-foreground-muted"
                    }
                  >
                    {tile.time}
                  </span>
                  <span className="text-foreground-subtle">{tile.duration}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "truncate text-sm",
                      isDone
                        ? `text-foreground-muted line-through ${body}`
                        : isActive
                          ? `font-medium text-foreground ${display}`
                          : `text-foreground ${body}`,
                    ].join(" ")}
                  >
                    {tile.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-foreground-subtle">
                    <MapPin className="h-3 w-3" strokeWidth={1.5} />
                    <span className={body}>{tile.place}</span>
                  </p>
                  {isActive ? (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full w-2/3 rounded-full bg-primary" />
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-foreground-muted">
                  {isActive ? (
                    <Pause className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  ) : isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-foreground-subtle" strokeWidth={1.5} />
                  ) : (
                    <Circle className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-xl border border-surface-2 bg-surface-0 px-3 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-foreground-muted">
            <AlarmClock className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className={body}>
              {t.previewNextLabel}{" "}
              <span className="font-[family-name:var(--font-geist-mono)] text-foreground">
                {t.previewNextAt}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background">
            <Check className="h-3 w-3" strokeWidth={2} />
            {t.previewNextAction}
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 hidden h-24 w-24 rounded-full bg-primary/12 blur-2xl lg:block"
      />
    </div>
  );
}
