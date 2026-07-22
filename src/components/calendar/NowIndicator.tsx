"use client";

import { useMinuteClock } from "@/lib/hooks/minute-clock";

export interface NowIndicatorProps {
  /** px per hour in the time grid. The line lands at (nowMins / 60) * hourHeight. */
  hourHeight: number;
  /** First hour of the grid (0–23 for "scope", currentHour±12 for "around/future"). */
  startHour: number;
  /** YYYY-MM-DD for the displayed day; the indicator hides if today is different. */
  effectiveDay: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The "current time" red line + dot on the day/week time grid.
 *
 * Reads the shared 60s clock from MinuteClockProvider so the line drifts
 * in real time without each calendar subview owning its own ticker. The
 * parent (DayView/WeekView) only renders this on the today column; the
 * 60s tick comes from the single provider in /dashboard/timeline/page.tsx.
 *
 * SSR note: the position depends on `Date.now()` which differs between
 * server and client. We bail out until after the first client commit
 * (nowMs > 0 means provider has run an effect) so React doesn't emit a
 * hydration-mismatch warning that bails out of patching.
 */
export function NowIndicator({ hourHeight, startHour, effectiveDay }: NowIndicatorProps) {
  const sharedNowMs = useMinuteClock();
  const nowMs = sharedNowMs ?? 0;
  if (nowMs === 0) return null;
  if (effectiveDay !== todayIso()) return null;

  const now = new Date(nowMs);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  // Match DayView's wrap-around handling so the line lands inside the
  // grid even when the hour grid is rotated (around/future modes).
  const nowTop = (((nowMins - startHour * 60 + 24 * 60) % (24 * 60)) / 60) * hourHeight;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 h-px bg-primary"
      style={{ top: `${nowTop}px` }}
      data-testid="now-indicator"
    >
      <span className="absolute -top-1.5 -left-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
    </div>
  );
}
