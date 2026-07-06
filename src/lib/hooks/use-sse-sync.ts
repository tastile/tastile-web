"use client";

import { useEffect } from "react";

export function useSseSync(opts: {
  accessToken: string;
  onEvent: (data: unknown) => void;
  enabled?: boolean;
}) {
  const { accessToken, onEvent, enabled } = opts;
  useEffect(() => {
    if (enabled === false) return;
    const base = process.env.NEXT_PUBLIC_TASTILE_CORE_URL ?? "http://127.0.0.1:31400";
    const url = new URL(`${base}/read/events/state`);
    url.searchParams.set("access_token", accessToken);
    const es = new EventSource(url.toString());
    es.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch {
        /* malformed event — ignore */
      }
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [accessToken, onEvent, enabled]);
}
