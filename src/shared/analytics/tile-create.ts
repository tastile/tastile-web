/**
 * tile-create analytics — `tile_create_attempt` event sink.
 *
 * Issue #24 A5b: QuickCreate submit handler emits a single
 * `tile_create_attempt` analytics event per submit attempt with the
 * `outcome` / `duration_ms` / `error_code` fields described in the
 * acceptance criteria. The default implementation is a thin
 * `console.info` and a stub `window.tastile?.track?.(...)` call so a
 * downstream GA4 / Plausible hook can replace it without further
 * plumbing.
 *
 * Side-effect free in SSR (no `window` access at module scope).
 */

import type { TileCreateAttemptEvent } from "@/shared/api/v1/submit";

declare global {
  interface Window {
    tastile?: {
      track?: (event: string, props: Record<string, unknown>) => void;
    };
  }
}

export function recordTileCreateAttempt(event: TileCreateAttemptEvent): void {
  if (typeof window === "undefined") return;
  try {
    console.info("tile_create_attempt", event);
  } catch {
    // console.info should never throw; ignore defensively.
  }
  try {
    window.tastile?.track?.("tile_create_attempt", event as unknown as Record<string, unknown>);
  } catch {
    // Tracking sinks must never break the submit path.
  }
}
