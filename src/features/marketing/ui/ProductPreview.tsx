import {
  AlarmClock,
  Check,
  CheckCircle2,
  Circle,
  MapPin,
  Pause,
} from "lucide-react";
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
      <div className="rounded-2xl bg-surface-elevated p-5 shadow-[0_18px_60px_-30px_rgba(17,18,23,0.18)] lg:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="mkt-pulse-dot inline-block size-1.5 rounded-full bg-primary" />
            <span
              className={`text-caption font-medium uppercase tracking-[0.18em] text-foreground-muted ${display}`}
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
                  "inline-flex h-5 items-center rounded-full px-2 text-caption font-medium tracking-wide",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-surface-0 text-foreground-subtle",
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5",
                  isActive
                    ? "bg-primary/[0.06]"
                    : isDone
                      ? "bg-surface-0 opacity-60"
                      : "bg-surface-0",
                ].join(" ")}
                style={{ animationDelay: `${200 + i * 80}ms` }}
              >
                <div className="flex w-16 shrink-0 flex-col font-[family-name:var(--font-geist-mono)] text-caption leading-tight">
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
                  <span className="text-foreground-subtle">
                    {tile.duration}
                  </span>
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
                  <p className="mt-0.5 flex items-center gap-1 truncate text-caption text-foreground-subtle">
                    <MapPin
                      className="size-3"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
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
                    <Pause
                      className="size-4 text-primary"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  ) : isDone ? (
                    <CheckCircle2
                      className="size-4 text-foreground-subtle"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="size-4"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-xl bg-surface-0 px-3 py-2.5">
          <div className="flex items-center gap-2 text-caption text-foreground-muted">
            <AlarmClock
              className="size-3.5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span className={body}>
              {t.previewNextLabel}{" "}
              <span className="font-[family-name:var(--font-geist-mono)] text-foreground">
                {t.previewNextAt}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-caption font-medium text-background">
            <Check className="size-3" strokeWidth={2} aria-hidden="true" />
            {t.previewNextAction}
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 hidden size-24 rounded-full bg-primary/12 blur-2xl lg:block"
      />
    </div>
  );
}
