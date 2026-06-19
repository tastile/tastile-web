"use client";

import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function fetch_() {
      const res = await getCoreClient().call<ExecutionViewSnapshot>("getExecutionView");
      if (cancelled || !mountedRef.current) return;
      if (res.ok) {
        setSnapshot(res.data);
      } else {
        setError(new Error(res.error.message));
      }
      setLoading(false);
    }

    void fetch_();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  return { snapshot, loading, error };
}
