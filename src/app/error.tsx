"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side errors carry a digest for tracing in production logs.
    // Skip the noisy stack on the client when one is present.
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- local dev aid only
      console.error("[tastile-web] unhandled error boundary:", error);
    }
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-foreground"
    >
      <h1 className="font-mono text-sm uppercase tracking-wider text-foreground-subtle">
        Something went wrong
      </h1>
      <p className="max-w-md text-center text-sm text-foreground-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-fg transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
