"use client";

import type { RefCallback } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseZoomOptions {
  /** Min pixels per logical unit. Default 32. */
  min?: number;
  /** Max pixels per logical unit. Default 192. */
  max?: number;
  /** Pixels per wheel tick. Default 8. */
  step?: number;
}

interface UseZoomResult<T extends HTMLElement> {
  /**
   * Callback ref — pass to the element you want to receive
   * gestures. Stable across renders so it can be used directly
   * as `<div ref={ref}>`.
   */
  ref: RefCallback<T>;
  /** Current zoom value (pixels per hour for the calendar grid). */
  zoom: number;
  /** Reset to initial value. */
  reset: () => void;
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null;
  while (p) {
    const style = window.getComputedStyle(p);
    if (/(auto|scroll|overlay)/.test(style.overflowY) && p.scrollHeight > p.clientHeight) {
      return p;
    }
    p = p.parentElement;
  }
  return null;
}

/**
 * Zoom gesture handler that keeps the time under the cursor (or pinch
 * midpoint) stationary.
 *
 *   - **Ctrl/Cmd + wheel** (desktop) — preventDefault to suppress the
 *     browser's page-zoom, then add/subtract `step` per wheel tick.
 *   - **Trackpad pinch** on macOS fires `wheel` events with `ctrlKey`,
 *     so the same handler covers it.
 *   - **Two-finger pinch** on touchscreens — track the distance between
 *     the two touches between touchstart and touchmove, scale the zoom
 *     by the ratio. Anchor is the midpoint at touchstart so content
 *     under that midpoint stays put.
 *
 * Smoothness: per-event `setZoom` would re-render the entire grid
 * (`layoutDayLanes` + 24 hour cells + N event blocks) at the gesture's
 * native rate (60–120 Hz on trackpad / touch). To avoid that, the
 * visual zoom is applied directly to the grid element via
 * `transform: scaleY(ratio)` with `transform-origin` anchored at the
 * cursor / midpoint. React state (`zoom`) is only committed on gesture
 * end (touchend) or coalesced via `requestAnimationFrame` (wheel /
 * trackpad) — at most one re-render per frame for wheel and zero
 * mid-gesture re-renders for pinch.
 *
 * Implementation note: the ref is exposed as a *callback ref* rather
 * than `RefObject`, so the effect can key off the element being
 * attached (React 19 stopped populating `useRef().current` synchronously
 * for some lifecycles, which left useEffect running with `null`).
 */
export function useZoom<T extends HTMLElement = HTMLElement>({
  min = 32,
  max = 192,
  step = 8,
  initial,
}: UseZoomOptions & { initial?: number } = {}): UseZoomResult<T> {
  const [zoom, setZoom] = useState(initial ?? 56);
  const initialRef = useRef(initial ?? 56);

  const elRef = useRef<T | null>(null);
  // _attachedTick is read by React to subscribe to changes; setAttachedTick is the trigger.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_attachedTick, setAttachedTick] = useState(0);

  const scrollParentCacheRef = useRef<HTMLElement | null>(null);
  const ref: RefCallback<T> = useCallback((node) => {
    const prev = elRef.current;
    elRef.current = node;
    if (prev !== node) {
      setAttachedTick((t) => t + 1);
      // Cached scroll parent belongs to the previous element — invalidate.
      scrollParentCacheRef.current = null;
    }
  }, []);

  const stepRef = useRef(step);
  const clampRef = useRef({ min, max });

  // Keep refs in sync with the latest props/state. Doing this in an
  // effect avoids mutating refs during render, which the React linter
  // forbids (refs are values, not sources of truth).
  useEffect(() => {
    stepRef.current = step;
    clampRef.current = { min, max };
  });

  // The zoom value React state holds. While a gesture is in flight we
  // apply a CSS transform on top of this base, so `zoom` only advances
  // once per gesture (touch) or once per animation frame (wheel).
  const committedZoomRef = useRef(initial ?? 56);

  const getScrollParent = useCallback((): HTMLElement | null => {
    const el = elRef.current;
    if (!el) return null;
    const cached = scrollParentCacheRef.current;
    if (cached?.isConnected) return cached;
    const next = findScrollParent(el);
    scrollParentCacheRef.current = next;
    return next;
  }, []);

  // Wheel/trackpad commit is coalesced through rAF. `pendingZoomRef`
  // always holds the latest pending target so multiple wheel ticks in
  // the same frame collapse into a single setZoom.
  const pendingZoomRef = useRef<{ zoom: number; anchor: number } | null>(null);
  const wheelRafRef = useRef<number | null>(null);

  // Pinch gesture bookkeeping. `lastZoom` / `lastAnchor` are updated on
  // each touchmove and used by touchend to commit.
  const pinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialAnchorContentY: number;
    lastZoom: number;
    lastAnchor: number;
  } | null>(null);

  const clearVisual = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    el.style.transform = "";
    el.style.transformOrigin = "";
    el.style.willChange = "";
  }, []);

  // Apply a CSS transform that visually scales the grid by `ratio`
  // around the cursor / midpoint at `anchorRel` (measured from the
  // grid top). No React state change — the gesture's logical zoom is
  // tracked separately in committedZoomRef / pendingZoomRef / pinchRef.
  const applyVisualZoom = useCallback((zoomValue: number, anchorClientY: number) => {
    const el = elRef.current;
    if (!el) return;
    const base = committedZoomRef.current;
    if (zoomValue === base) return;
    const rect = el.getBoundingClientRect();
    const anchorRel = Math.max(0, anchorClientY - rect.top);
    const ratio = zoomValue / base;
    el.style.transform = `scaleY(${ratio})`;
    el.style.transformOrigin = `0 ${anchorRel}px`;
    el.style.willChange = "transform";
  }, []);

  // Clear the visual transform and commit the new zoom to React state.
  // Adjust the nearest scrollable ancestor's scrollTop so the time
  // under the cursor stays put after the layout update lands.
  const commitZoom = useCallback(
    (zoomValue: number, anchorClientY: number) => {
      const el = elRef.current;
      if (!el) return;
      // Always clear the transform, even if value didn't change (touch
      // gesture that returned to the same zoom must not leave a stale
      // transform behind).
      el.style.transform = "";
      el.style.transformOrigin = "";
      el.style.willChange = "";
      const base = committedZoomRef.current;
      if (zoomValue === base) return;
      const rect = el.getBoundingClientRect();
      const anchorRel = Math.max(0, anchorClientY - rect.top);
      const scrollParent = getScrollParent();
      const oldScrollTop = scrollParent?.scrollTop ?? 0;
      const ratio = zoomValue / base;
      const newScrollTop = oldScrollTop + anchorRel * (ratio - 1);
      committedZoomRef.current = zoomValue;
      setZoom(zoomValue);
      if (scrollParent && Number.isFinite(newScrollTop) && newScrollTop >= 0) {
        scrollParent.scrollTop = newScrollTop;
      }
    },
    [getScrollParent],
  );

  // Schedule a commit on the next animation frame. Multiple calls in
  // the same frame coalesce into a single setZoom (last write wins).
  const scheduleCommit = useCallback(
    (zoomValue: number, anchorClientY: number) => {
      applyVisualZoom(zoomValue, anchorClientY);
      pendingZoomRef.current = { zoom: zoomValue, anchor: anchorClientY };
      if (wheelRafRef.current === null) {
        wheelRafRef.current = requestAnimationFrame(() => {
          wheelRafRef.current = null;
          const pending = pendingZoomRef.current;
          if (!pending) return;
          pendingZoomRef.current = null;
          commitZoom(pending.zoom, pending.anchor);
        });
      }
    },
    [applyVisualZoom, commitZoom],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: _attachedTick is a ref-attachment signal
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      // Use the pending zoom (if any) as the base so consecutive
      // ticks in the same frame accumulate instead of being
      // re-computed from the previously-committed value.
      const pending = pendingZoomRef.current;
      const base = pending ? pending.zoom : committedZoomRef.current;
      const { min, max } = clampRef.current;
      const direction = e.deltaY > 0 ? -1 : 1;
      const newZoom = Math.max(min, Math.min(max, base + direction * stepRef.current));
      scheduleCommit(newZoom, e.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        pinchRef.current = null;
        return;
      }
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      if (!t0 || !t1) return;
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      const initialDist = Math.hypot(dx, dy);
      const midY = (t0.clientY + t1.clientY) / 2;
      const gridEl = elRef.current;
      if (!gridEl) return;
      const rect = gridEl.getBoundingClientRect();
      const anchorRel = Math.max(0, midY - rect.top);
      const scrollParent = getScrollParent();
      const scrollTop = scrollParent?.scrollTop ?? 0;
      const initialZoom = committedZoomRef.current;
      pinchRef.current = {
        initialDist,
        initialZoom,
        initialAnchorContentY: anchorRel + scrollTop,
        lastZoom: initialZoom,
        lastAnchor: midY,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      if (!t0 || !t1) return;
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const state = pinchRef.current;
      const { initialDist, initialZoom } = state;
      if (initialDist <= 0) return;
      const ratio = dist / initialDist;
      const { min, max } = clampRef.current;
      const newZoom = Math.max(min, Math.min(max, initialZoom * ratio));
      // Apply visual transform; do NOT commit during the gesture.
      applyVisualZoom(newZoom, (t0.clientY + t1.clientY) / 2);
      state.lastZoom = newZoom;
      state.lastAnchor = (t0.clientY + t1.clientY) / 2;
    };

    const onTouchEnd = () => {
      const state = pinchRef.current;
      pinchRef.current = null;
      if (!state) return;
      if (state.lastZoom !== state.initialZoom) {
        commitZoom(state.lastZoom, state.lastAnchor);
      } else {
        // Pinch started and ended without a real zoom delta — clear
        // any stray transform that an early touchmove may have left.
        clearVisual();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (wheelRafRef.current !== null) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
      clearVisual();
    };
  }, [applyVisualZoom, clearVisual, commitZoom, getScrollParent, scheduleCommit, _attachedTick]);

  const reset = useCallback(() => {
    clearVisual();
    committedZoomRef.current = initialRef.current;
    setZoom(initialRef.current);
  }, [clearVisual]);

  return { ref, zoom, reset };
}
