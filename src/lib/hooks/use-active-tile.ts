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

export function useActiveTile() {
  const [snapshot, setSnapshot] = useState<ExecutionViewSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const fetchSnapshot = useCallback(async () => {
    const res = await getCoreClient().call<ExecutionViewSnapshot>("getExecutionView");
    if (!mountedRef.current) return;
    if (res.ok) {
      setSnapshot(res.data);
      setError(null);
    } else {
      setError(new Error(res.error.message));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchSnapshot();
    const interval = window.setInterval(() => void fetchSnapshot(), 15_000);
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
