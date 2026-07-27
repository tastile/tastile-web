"use client";

import { useInterval } from "@mantine/hooks";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

// One-minute wall clock shared across calendar subviews. Previously every
// calendar component ran its own `setInterval(..., 60_000)`; this context
// keeps a single interval alive for the entire timeline subtree and exposes
// the current epoch milliseconds via `useMinuteClock()`. Consumers outside
// the provider receive `null` and should fall back to a per-component tick
// or skip the dynamic update.

const MinuteClockContext = createContext<number | null>(null);

export function MinuteClockProvider({ children }: { children: ReactNode }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const interval = useInterval(() => setNowMs(Date.now()), 60_000);
  useEffect(() => {
    interval.start();
    return interval.stop;
  }, [interval]);
  return <MinuteClockContext.Provider value={nowMs}>{children}</MinuteClockContext.Provider>;
}

export function useMinuteClock(): number | null {
  return useContext(MinuteClockContext);
}
