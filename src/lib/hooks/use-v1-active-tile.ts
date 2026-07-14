"use client";

/**
 * useV1ActiveTile -- thin polling wrapper around `GET /v1/active-tile`.
 *
 * The v1 endpoint returns the placement the engine is currently
 * executing (the "main tile").  It carries the v1 IDs we need to
 * drive pause / resume / finish on the matching execution.
 *
 * This is intentionally separate from `useActiveTile`, which polls
 * the v0-era `getExecutionView` (ExecutionViewSnapshot) for the
 FloatingHeader countdown.  New lifecycle controls should read
 from this hook so the wire IDs and the polling cadence match the
 v1 API.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";

export interface V1ActiveTileSnapshot {
  tile_id: string;
  placement_id: string;
  execution_id: string | null;
  title: string;
  span_start: string;
  span_end: string;
}

const EMPTY: V1ActiveTileSnapshot | null = null;

export function useV1ActiveTile(): {
  snapshot: V1ActiveTileSnapshot | null;
  loading: boolean;
  error: Error | null;
} {
  const [snapshot, setSnapshot] = useState<V1ActiveTileSnapshot | null>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const fetchSnapshot = useCallback(async () => {
    const res = await getCoreClient().call<V1ActiveTileSnapshot>("getActiveTile");
    if (!mountedRef.current) return;
    if (res.ok) {
      setSnapshot(res.data ?? null);
      setError(null);
    } else {
      const msg = res.error.message;
      setError((prev) => (prev?.message === msg ? prev : new Error(msg)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchSnapshot();
    const interval = window.setInterval(() => void fetchSnapshot(), 5_000);
    const onChanged = () => void fetchSnapshot();
    window.addEventListener("tastile:execution-changed", onChanged);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("tastile:execution-changed", onChanged);
      mountedRef.current = false;
    };
  }, [fetchSnapshot]);

  return { snapshot, loading, error };
}
