// src/components/schedule/LoadingOverlay.tsx
"use client";

import { Skeleton } from "@mantine/core";
import type { ReactNode } from "react";

// Mantine Skeleton applies `height: var(--skeleton-height, auto)` and
// `width: var(--skeleton-width, 100%)` via its CSS-module class
// (unlayered CSS). That declaration wins over Tailwind's
// `@layer utilities` rules, so any `h-N` / `w-N` className on a
// Skeleton is silently ignored — the bar collapses to 0×0. Always
// pass Mantine's `height` prop instead (and use className for `w-*`,
// `rounded-*`, etc. only).
//
// Note on Month view: this LoadingOverlay is NOT used by MonthPanel
// anymore. Month passes fake loading events straight into MonthView
// (see MonthPanel.tsx) so the skeleton chips render INSIDE the real
// day cells — no overlay on top of the panel.

export type LoadingOverlayView = "day" | "week" | "year" | "agenda";

export function LoadingOverlay({
  loading,
  view,
  children,
}: {
  loading: boolean;
  view: LoadingOverlayView;
  children: ReactNode;
}) {
  return (
    <div className="relative h-full">
      {children}
      {loading ? <ViewSkeleton view={view} /> : null}
    </div>
  );
}

// A view-shaped skeleton: gray bars / boxes mirroring the eventual layout so
// the panel reads as "content is coming" instead of a "Loading…" overlay.
// Per design feedback, the loading state must never be a text label.
function ViewSkeleton({ view }: { view: LoadingOverlayView }) {
  switch (view) {
    case "day":
      return <DaySkeleton />;
    case "week":
      return <WeekSkeleton />;
    case "year":
      return <YearSkeleton />;
    case "agenda":
      return <AgendaSkeleton />;
  }
}

function DaySkeleton() {
  // Sized via the Mantine Skeleton `height` prop rather than Tailwind
  // `h-N` utilities. Mantine's CSS module applies `height: var
  // (--skeleton-height, auto)` as unlayered CSS, which wins over
  // Tailwind's `@layer utilities` rule and would collapse each bar
  // to 0px (verified empirically in browser).
  return (
    <div
      data-testid="day-loading"
      role="status"
      aria-label="Loading day"
      className="pointer-events-none absolute inset-0 flex flex-col gap-2 overflow-hidden bg-surface-0/40 p-3"
    >
      {/* hour-label + slot bars stacked vertically to mirror a 24h day grid */}
      <Skeleton height={12} className="w-16" />
      <Skeleton height={40} className="ml-12 w-2/3 rounded-md" />
      <Skeleton height={24} className="ml-12 w-1/3 rounded-md" />
      <Skeleton height={12} className="w-16" />
      <Skeleton height={48} className="ml-12 w-1/2 rounded-md" />
      <Skeleton height={12} className="w-16" />
      <Skeleton height={32} className="ml-12 w-1/4 rounded-md" />
    </div>
  );
}

function WeekSkeleton() {
  return (
    <div
      data-testid="week-loading"
      role="status"
      aria-label="Loading week"
      className="pointer-events-none absolute inset-0 flex flex-col gap-2 overflow-hidden bg-surface-0/40 p-3"
    >
      {/* 7-column header strip */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} height={12} className="w-full" />
        ))}
      </div>
      {/* a few "event" bars scattered across the columns */}
      <div className="mt-2 grid grid-cols-7 gap-2">
        <Skeleton height={32} className="col-span-2 rounded-md" />
        <Skeleton height={24} className="col-span-1 rounded-md" />
        <Skeleton height={40} className="col-span-2 rounded-md" />
      </div>
      <div className="grid grid-cols-7 gap-2">
        <Skeleton height={24} className="col-span-1 rounded-md" />
        <Skeleton height={32} className="col-span-3 rounded-md" />
        <Skeleton height={24} className="col-span-1 rounded-md" />
      </div>
    </div>
  );
}

function YearSkeleton() {
  // 4×3 grid of month blocks. Each block has a "month label" bar and a
  // handful of small indicator dots like the real YearView renders.
  return (
    <div
      data-testid="year-loading"
      role="status"
      aria-label="Loading year"
      className="pointer-events-none absolute inset-0 flex flex-col gap-3 overflow-hidden bg-surface-0/40 p-3"
    >
      <div className="grid flex-1 grid-cols-4 grid-rows-3 gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static 4×3 placeholder
            key={i}
            className="flex flex-col gap-2 rounded border border-surface-2/40 p-2"
          >
            <Skeleton height={12} className="w-1/2" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 28 }, (_, j) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder
                  key={j}
                  height={8}
                  className="w-full rounded-sm"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaSkeleton() {
  // A vertical list of "agenda item" rows: title bar + meta bar + time bar.
  return (
    <div
      data-testid="agenda-loading"
      role="status"
      aria-label="Loading agenda"
      className="pointer-events-none absolute inset-0 flex flex-col gap-2 overflow-hidden bg-surface-0/40 p-3"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static 5-row placeholder
          key={i}
          className="flex items-center gap-3 rounded-md border border-surface-2/40 px-3 py-2.5"
        >
          <Skeleton height={32} className="w-1 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton height={16} className="w-2/3" />
            <Skeleton height={12} className="w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
