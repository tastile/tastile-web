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
 * Zoom gesture handler that keeps the time under the cursor (or
 * pinch midpoint) stationary.
 *
 *   - **Ctrl/Cmd + wheel** (desktop) — preventDefault to suppress the
 *     browser's page-zoom, then add/subtract `step` per wheel tick.
 *     scrollTop on the nearest scrollable ancestor is adjusted so the
 *     time under the cursor stays under the cursor.
 *   - **Trackpad pinch** on macOS fires `wheel` events with `ctrlKey`,
 *     so the same handler covers it.
 *   - **Two-finger pinch** on touchscreens — track the distance
 *     between the two touches between touchstart and touchmove,
 *     scale the zoom by the ratio. Anchor is the midpoint at
 *     touchstart so content under that midpoint stays put.
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
  const [_attachedTick, setAttachedTick] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars

  const ref: RefCallback<T> = useCallback((node) => {
    const prev = elRef.current;
    elRef.current = node;
    if (prev !== node) setAttachedTick((t) => t + 1);
  }, []);

  const zoomRef = useRef(zoom);
  const stepRef = useRef(step);
  const clampRef = useRef({ min, max });

  // Keep refs in sync with the latest props/state. Doing this in an
  // effect avoids mutating refs during render, which the React linter
  // forbids (refs are values, not sources of truth).
  useEffect(() => {
    zoomRef.current = zoom;
    stepRef.current = step;
    clampRef.current = { min, max };
  });

  const pinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    anchorContentY: number;
    anchorRel: number;
  } | null>(null);

  // Compute and apply a zoom change anchored at `anchorClientY`
  // (cursor or pinch midpoint in viewport coords). Adjusts the
  // nearest scrollable ancestor's scrollTop so the content under
  // `anchorClientY` stays at `anchorClientY` after the zoom.
  //
  // Math: at the moment of the zoom, the cursor's content-position
  // in the grid is `anchorRel = anchorClientY - gridRect.top`. After
  // the zoom each hour occupies newZoom px, so the same content is
  // at anchorRel * (newZoom / oldZoom). We need the cursor (which
  // stays put on screen) to land on that new position, so:
  //   newScrollTop = oldScrollTop + anchorRel * (newZoom/oldZoom - 1)
  const applyAnchored = useCallback((newZoom: number, anchorClientY: number) => {
    const el = elRef.current;
    if (!el) {
      setZoom(newZoom);
      return;
    }
    const oldZoom = zoomRef.current;
    if (newZoom === oldZoom) return;
    const rect = el.getBoundingClientRect();
    // anchorRel can be negative if the cursor is above the grid
    // (e.g. on the sticky All Day header). Treat negative values
    // as 0 — we don't want to scroll content past the top.
    const anchorRel = Math.max(0, anchorClientY - rect.top);
    const scrollParent = findScrollParent(el);
    const oldScrollTop = scrollParent?.scrollTop ?? 0;
    const ratio = newZoom / oldZoom;
    const newScrollTop = oldScrollTop + anchorRel * (ratio - 1);
    setZoom(newZoom);
    if (scrollParent && Number.isFinite(newScrollTop) && newScrollTop >= 0) {
      scrollParent.scrollTop = newScrollTop;
    }
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      const oldZoom = zoomRef.current;
      const { min, max } = clampRef.current;
      const newZoom = Math.max(min, Math.min(max, oldZoom + direction * stepRef.current));
      applyAnchored(newZoom, e.clientY);
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
      const scrollParent = findScrollParent(gridEl);
      const scrollTop = scrollParent?.scrollTop ?? 0;
      pinchRef.current = {
        initialDist,
        initialZoom: zoomRef.current,
        anchorContentY: anchorRel + scrollTop,
        anchorRel,
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
      const { initialDist, initialZoom, anchorContentY, anchorRel } = pinchRef.current;
      if (initialDist <= 0) return;
      const ratio = dist / initialDist;
      const { min, max } = clampRef.current;
      const newZoom = Math.max(min, Math.min(max, initialZoom * ratio));
      const scrollParent = findScrollParent(elRef.current);
      const newScrollTop = anchorContentY * (newZoom / initialZoom) - anchorRel;
      setZoom(newZoom);
      if (scrollParent && Number.isFinite(newScrollTop) && newScrollTop >= 0) {
        scrollParent.scrollTop = newScrollTop;
      }
    };

    const onTouchEnd = () => {
      pinchRef.current = null;
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
    };
  }, [applyAnchored]);

  const reset = useCallback(() => setZoom(initialRef.current), []);

  return { ref, zoom, reset };
}
