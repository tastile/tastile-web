// src/components/schedule/useTimelineState.ts
"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export type ScheduleView = "day" | "week" | "month" | "year" | "agenda";
const VALID_VIEWS: ScheduleView[] = ["day", "week", "month", "year", "agenda"];

export type DisplayMode = "scope" | "around" | "future";
const VALID_MODES: DisplayMode[] = ["scope", "around", "future"];

const ZOOM_MIN = 24;
const ZOOM_MAX = 160;
const ZOOM_DEFAULT = 56;
const ZOOM_STEP = 8;

function parseView(s: string | null): ScheduleView {
  return VALID_VIEWS.includes(s as ScheduleView) ? (s as ScheduleView) : "day";
}
function parseMode(s: string | null): DisplayMode {
  return VALID_MODES.includes(s as DisplayMode) ? (s as DisplayMode) : "scope";
}
function parseZoom(s: string | null): number {
  const n = s ? Number(s) : Number.NaN;
  if (Number.isNaN(n)) return ZOOM_DEFAULT;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, n));
}

function todayLocalIso(): string {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function shiftDate(date: string, view: ScheduleView, delta: -1 | 1): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (view === "day" || view === "agenda") d.setUTCDate(d.getUTCDate() + delta);
  else if (view === "week") d.setUTCDate(d.getUTCDate() + delta * 7);
  else if (view === "month") d.setUTCMonth(d.getUTCMonth() + delta);
  else d.setUTCFullYear(d.getUTCFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

export interface TimelineState {
  view: ScheduleView;
  mode: DisplayMode;
  anchor: string;
  zoom: number;
  effectiveAnchor: string;
  setView: (v: ScheduleView) => void;
  setMode: (m: DisplayMode) => void;
  setAnchor: (a: string) => void;
  setZoom: (z: number) => void;
  shiftAnchor: (delta: -1 | 1) => void;
  goToToday: () => void;
  todayLocal: () => string;
}

export function useTimelineState(initialView: ScheduleView = "day"): TimelineState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ view?: string }>();

  const view = useMemo(() => {
    if (params.view && VALID_VIEWS.includes(params.view as ScheduleView)) {
      return params.view as ScheduleView;
    }
    return initialView !== "day" ? initialView : parseView(searchParams.get("view"));
  }, [params.view, searchParams, initialView]);

  const mode = parseMode(searchParams.get("mode"));
  const anchor = searchParams.get("date") ?? todayLocalIso();
  const zoom = parseZoom(searchParams.get("zoom"));
  const effectiveAnchor = mode === "scope" ? anchor : todayLocalIso();

  const syncUrl = useCallback(
    (next: { view?: ScheduleView; mode?: DisplayMode; date?: string; zoom?: number }) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (next.view !== undefined) qs.set("view", next.view);
      if (next.mode !== undefined) {
        if (next.mode === "scope") qs.delete("mode");
        else qs.set("mode", next.mode);
      }
      if (next.date !== undefined) {
        if (next.date === todayLocalIso()) qs.delete("date");
        else qs.set("date", next.date);
      }
      if (next.zoom !== undefined) {
        if (next.zoom === ZOOM_DEFAULT) qs.delete("zoom");
        else qs.set("zoom", String(next.zoom));
      }
      const url = qs.toString() ? `${pathname}?${qs.toString()}` : pathname;
      router.replace(url, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setView = useCallback((v: ScheduleView) => syncUrl({ view: v }), [syncUrl]);
  const setMode = useCallback((m: DisplayMode) => syncUrl({ mode: m }), [syncUrl]);
  const setAnchor = useCallback(
    (a: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a)) return;
      syncUrl({ date: a });
    },
    [syncUrl],
  );
  const setZoom = useCallback(
    (z: number) => syncUrl({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) }),
    [syncUrl],
  );
  const shiftAnchor = useCallback(
    (delta: -1 | 1) => syncUrl({ date: shiftDate(anchor, view, delta) }),
    [syncUrl, anchor, view],
  );
  const goToToday = useCallback(() => syncUrl({ date: todayLocalIso() }), [syncUrl]);
  const todayLocal = useCallback(() => todayLocalIso(), []);

  return {
    view,
    mode,
    anchor,
    zoom,
    effectiveAnchor,
    setView,
    setMode,
    setAnchor,
    setZoom,
    shiftAnchor,
    goToToday,
    todayLocal,
  };
}

export {    ZOOM_STEP };
