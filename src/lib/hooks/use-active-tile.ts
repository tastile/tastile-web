"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";

export interface ExecutionViewSnapshot {
  is_working: boolean;
  is_on_break: boolean;
  is_idle: boolean;
  main_tile: {
    id: string;
    title: string;
  } | null;
  main_tile_started_at: string | null;
  main_tile_ends_at: string | null;
  tile_count: number;
  event_count: number;
  tiles_in_progress: Array<{ id: string; title: string }>;
  pending_prompt_id: string | null;
}

// Polling cadence used while the previous poll succeeded. When the
// upstream returns a 5xx or the fetch itself fails, the next poll waits
// longer so a permanently-down daemon doesn't burn CPU/network and
// pollute the browser console with redundant errors.
const BASE_INTERVAL_MS = 15_000;
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Compute the delay for the next poll based on the most recent result.
 * Successful polls reset to the base cadence. Failed polls grow the
 * delay (15s → 30s → 60s → 120s → 240s → … capped at 5 minutes).
 */
function nextDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return BASE_INTERVAL_MS;
  const exp = Math.min(consecutiveFailures, 6); // 2^6 = 64× base
  return Math.min(BASE_INTERVAL_MS * 2 ** exp, MAX_BACKOFF_MS);
}

export function useActiveTile() {
  const [snapshot, setSnapshot] = useState<ExecutionViewSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const failuresRef = useRef(0);
  const fetchSnapshot = useCallback(async () => {
    const res = await getCoreClient().call<ExecutionViewSnapshot>("getExecutionView");
    if (!mountedRef.current) return;
    if (res.ok) {
      failuresRef.current = 0;
      setSnapshot(res.data);
      setError(null);
    } else {
      failuresRef.current += 1;
      // Keep the same Error instance when the message is unchanged so the
      // poll failure cycle doesn't create a new identity every tick and
      // re-render every consumer (FloatingHeader, ActivityBar, …).
      const msg = res.error.message;
      setError((prev) => (prev?.message === msg ? prev : new Error(msg)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    let timer: number | null = null;
    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void fetchSnapshot().then(() => {
          if (cancelled) return;
          schedule(nextDelayMs(failuresRef.current));
        });
      }, delay);
    };
    void fetchSnapshot().then(() => {
      if (cancelled) return;
      schedule(nextDelayMs(failuresRef.current));
    });
    const onChanged = () => {
      failuresRef.current = 0;
      void fetchSnapshot();
    };
    window.addEventListener("tastile:execution-changed", onChanged);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("tastile:execution-changed", onChanged);
      mountedRef.current = false;
    };
  }, [fetchSnapshot]);

  return { snapshot, loading, error };
}
