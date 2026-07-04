"use client";

import { useEffect, useState } from "react";
import { BUTTON_STYLES } from "@/lib/styles/button-styles";

type Plan = "free" | "pro";

/**
 * Probe `/api/auth/session` for safe session metadata. We never read or
 * hold Cognito tokens here — the route returns only `{sub, exp, owner_id}`.
 */
async function hasSafeSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { sub?: unknown };
    return typeof data.sub === "string";
  } catch {
    return false;
  }
}

export function SubscriptionSection() {
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Plan lookup lives on the daemon (billing service) and is not wired in β.
    // Until then, default to "free" once we have a session; show the loader
    // briefly so the UI doesn't flash an unauthenticated state.
    void (async () => {
      const authenticated = await hasSafeSession();
      setPlan(authenticated ? "free" : "free");
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-2 animate-pulse rounded" />
        <div className="p-6 bg-surface-2 rounded-lg">
          <div className="h-6 w-32 bg-surface-1 animate-pulse rounded mb-2" />
          <div className="h-4 w-64 bg-surface-1 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const isPro = plan === "pro";

  const features = {
    free: [
      "Up to 10 active tiles",
      "Basic execution control",
      "Web dashboard access",
      "Manual tile management",
    ],
    pro: [
      "Unlimited tiles",
      "Advanced automation",
      "Windows desktop client",
      "AI-powered suggestions",
      "Priority support",
      "Custom integrations",
    ],
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-surface-2 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Current Plan</h3>
            <p className="text-sm text-foreground-muted mt-1">
              {isPro
                ? "You have access to all Pro features"
                : "Upgrade to unlock advanced features"}
            </p>
          </div>
          <span
            className={`inline-block text-sm font-semibold px-3 py-1.5 rounded-full ${
              isPro ? "bg-primary/10 text-primary" : "bg-surface-1 text-foreground-muted"
            }`}
          >
            {isPro ? "Pro" : "Free"}
          </span>
        </div>

        <div className="flex gap-3">
          {isPro ? (
            <a href="/api/stripe/portal" className={BUTTON_STYLES.secondary}>
              Manage Billing
            </a>
          ) : (
            <a href="/api/stripe/checkout" className={BUTTON_STYLES.primary}>
              Upgrade to Pro
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className="p-6 bg-surface-2 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-lg font-semibold text-foreground">Free</h4>
            {!isPro && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                Current
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground mb-4">
            $0
            <span className="text-sm font-normal text-foreground-muted">/month</span>
          </p>
          <ul className="space-y-2">
            {features.free.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                <span className="text-success mt-0.5">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro Plan */}
        <div className="p-6 bg-surface-2 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-lg font-semibold text-foreground">Pro</h4>
            {isPro && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                Current
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground mb-4">
            $9
            <span className="text-sm font-normal text-foreground-muted">/month</span>
          </p>
          <ul className="space-y-2">
            {features.pro.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                <span className="text-primary mt-0.5">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className="mt-4">
              <a
                href="/api/stripe/checkout"
                className={`${BUTTON_STYLES.primary} w-full block text-center`}
              >
                Upgrade Now
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
