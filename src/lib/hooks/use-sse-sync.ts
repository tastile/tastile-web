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
    // SSE must go through the Next.js proxy so the browser never needs
    // direct access to the backend loopback address.
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const target = `${base}/api/proxy/read/events/state`;
    // URL.canParse guards against a missing/empty NEXT_PUBLIC_APP_URL
    // (e.g. when running under the SSR test environment without a
    // configured public origin) so the effect fails closed instead of
    // throwing TypeError during render.
    if (!URL.canParse(target)) return;
    const url = new URL(target);
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
