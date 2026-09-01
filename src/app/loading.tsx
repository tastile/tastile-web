"use client";

import { useReducedMotion } from "@mantine/hooks";
import { Loader2 } from "lucide-react";

export default function Loading() {
  const reduceMotion = useReducedMotion();
  return (
    <output
      aria-label="Loading…"
      className="flex min-h-dvh items-center justify-center bg-background text-foreground"
    >
      <Loader2
        aria-hidden="true"
        className={`size-6 text-foreground-subtle${reduceMotion ? "" : " animate-spin"}`}
      />
    </output>
  );
}
