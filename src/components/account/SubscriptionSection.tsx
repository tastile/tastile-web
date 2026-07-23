"use client";

import { type QueryFunctionContext, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { translations } from "@/lib/i18n/translations";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useLocaleStore } from "@/lib/stores/locale-store";

type SubscriptionState =
  | { status: "free" }
  | {
      status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid";
      interval: "monthly" | "yearly";
      priceId: string;
      customerId: string;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
    };

const subscriptionQueryKey = ["account", "subscription"] as const;

async function fetchSubscription({
  signal,
}: QueryFunctionContext<typeof subscriptionQueryKey>): Promise<SubscriptionState> {
  const res = await fetch("/api/billing/subscription", { cache: "no-store", signal });
  if (!res.ok) throw new Error("Failed to load subscription");
  const data = (await res.json()) as { subscription: SubscriptionState };
  return data.subscription;
}

async function openPortal(): Promise<void> {
  const res = await fetch("/api/stripe/portal", { method: "POST" });
  if (!res.ok) throw new Error("Failed to open billing portal");
  const { url } = (await res.json()) as { url?: string };
  if (url) window.location.href = url;
}

function statusLabel(t: (k: string) => string, status: SubscriptionState["status"]): string {
  if (status === "free") return t("account.subscription.statusFree");
  return t(`account.subscription.status${status.charAt(0).toUpperCase()}${status.slice(1)}`);
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

export function SubscriptionSection() {
  const { t } = useTranslation();
  const { locale } = useLocaleStore();
  const subDict = translations[locale].account.subscription;
  const subscriptionQuery = useQuery({
    queryKey: subscriptionQueryKey,
    queryFn: fetchSubscription,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [intervalChoice, setIntervalChoice] = useState<"monthly" | "yearly">("monthly");
  const [opening, setOpening] = useState(false);
  const state = subscriptionQuery.data ?? null;
  const loading = subscriptionQuery.isLoading;
  const error = actionError ?? (subscriptionQuery.isError ? t("account.subscription.error") : null);

  const handleManage = () => {
    setOpening(true);
    void openPortal()
      .catch((err: unknown) => {
        console.error(err);
        setActionError(t("account.subscription.error"));
      })
      .finally(() => {
        setOpening(false);
      });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-2 animate-pulse rounded" />
        <div className="border border-border bg-surface-0 rounded-md p-6">
          <div className="h-6 w-32 bg-surface-2 animate-pulse rounded mb-2" />
          <div className="h-4 w-64 bg-surface-2 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const isPro = state != null && state.status !== "free";
  const statusText = state ? statusLabel(t, state.status) : "";
  const proInterval = state && state.status !== "free" ? state.interval : intervalChoice;
  const freeFeatures = subDict.features.free;
  const proFeatures = subDict.features.pro;

  return (
    <div className="space-y-6">
      <section className="border border-border bg-surface-0 rounded-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t("account.subscription.currentPlan")}
            </h3>
            <p className="text-sm text-foreground-muted mt-1">
              {isPro
                ? t("account.subscription.proDescription")
                : t("account.subscription.freeDescription")}
            </p>
          </div>
          <span
            className={`inline-block text-sm font-semibold px-3 py-1.5 rounded-full ${isPro ? "bg-primary/10 text-primary" : "bg-surface-2 text-foreground-muted"}`}
          >
            {isPro ? t("account.subscription.proBadge") : t("account.subscription.freeBadge")}
          </span>
        </div>

        {state && state.status !== "free" && (
          <p className="text-xs text-foreground-muted mb-4">
            {statusText}
            {" · "}
            {state.cancelAtPeriodEnd
              ? t("account.subscription.autoRenewOff")
              : t("account.subscription.autoRenew")}
            {state.currentPeriodEnd > 0 && (
              <>
                {" · "}
                {t("account.subscription.nextBilling")}: {formatDate(state.currentPeriodEnd)}
              </>
            )}
          </p>
        )}

        {error && <p className="text-xs text-danger mb-4">{error}</p>}

        <div className="flex gap-3">
          {isPro ? (
            <button
              type="button"
              onClick={handleManage}
              disabled={opening}
              className="rounded-full bg-surface-3 px-4 py-2.5 text-sm font-semibold text-foreground"
            >
              {opening ? t("account.subscription.loading") : t("account.subscription.manage")}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              {t("account.subscription.upgrade")}
            </Link>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border border-border bg-surface-0 rounded-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-lg font-semibold text-foreground">{subDict.freePlanName}</h4>
            {!isPro && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                Current
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground mb-4">
            {subDict.freePlanPrice}
            <span className="text-sm font-normal text-foreground-muted">{subDict.perMonth}</span>
          </p>
          <ul className="space-y-2">
            {freeFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                <span className="text-success mt-0.5">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border border-border bg-surface-0 rounded-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-lg font-semibold text-foreground">{subDict.proPlanName}</h4>
            {isPro && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                Current
              </span>
            )}
          </div>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setIntervalChoice("monthly")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${proInterval === "monthly" ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground-subtle hover:text-foreground"}`}
            >
              {subDict.monthly}
            </button>
            <button
              type="button"
              onClick={() => setIntervalChoice("yearly")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${proInterval === "yearly" ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground-subtle hover:text-foreground"}`}
            >
              {subDict.yearly} <span className="text-success">{subDict.yearHint}</span>
            </button>
          </div>
          <p className="text-2xl font-bold text-foreground mb-4">
            {proInterval === "monthly" ? subDict.priceMonthly : subDict.priceYearly}
            <span className="text-sm font-normal text-foreground-muted">
              {proInterval === "monthly" ? subDict.perMonth : subDict.perYear}
            </span>
          </p>
          <ul className="space-y-2">
            {proFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                <span className="text-primary mt-0.5">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className="mt-4">
              <Link
                href="/pricing"
                className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover w-full block text-center"
              >
                {subDict.upgrade}
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
