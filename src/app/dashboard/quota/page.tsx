"use client";

import { PageSummaryPanel } from "@/components/panels/PageSummaryPanel";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { type Result, getCoreClient } from "@/lib/api/endpoints";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { cn } from "@/lib/utils/cn";
import { Alert, Badge, Button, Loader } from "@mantine/core";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";
import { CreditCard, Gauge, KeyRound, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface QuotaData {
  plan?: string;
  tiles_used?: number;
  tiles_limit?: number;
  history_days?: number;
  history_limit_days?: number;
  features?: Record<string, boolean>;
}

export default function QuotaPage() {
  const [data, setData] = useState<Result<QuotaData> | null>(null);
  const [session, setSession] = useState<Result<unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const sidePanel = useMemo(
    () => (
      <PageSummaryPanel
        title="Quota"
        description="Plan limits and current usage. Read-only — upgrade from the pricing page when you need more headroom."
        sections={[
          {
            heading: "Plan",
            items: [
              {
                label: "Tier",
                value: data?.ok ? (data.data.plan ?? "free") : "—",
              },
              {
                label: "Tiles",
                value: data?.ok
                  ? `${data.data.tiles_used ?? 0} / ${data.data.tiles_limit ?? "—"}`
                  : "—",
              },
              {
                label: "History",
                value: data?.ok
                  ? `${data.data.history_days ?? 0}d / ${data.data.history_limit_days ?? "—"}d`
                  : "—",
              },
            ],
          },
          {
            heading: "Related",
            items: [
              { label: "Billing", value: "→", href: "/dashboard/billing" },
              { label: "Timeline", value: "→", href: "/dashboard/timeline" },
              { label: "API explorer", value: "→", href: "/dashboard/api" },
            ],
          },
        ]}
      />
    ),
    [data],
  );
  useSidePanel(sidePanel);

  const load = useCallback(() => {
    setLoading(true);
    const client = getCoreClient();
    return Promise.all([client.call<QuotaData>("getTileQuota"), client.call("getSession")])
      .then(([q, s]) => {
        setData(q);
        setSession(s);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const plan = (data?.ok && data.data.plan) || (session?.ok ? "free" : "—");
  const tilesUsed = Number(data?.ok && data.data.tiles_used) || 0;
  const tilesLimit = Number(data?.ok && data.data.tiles_limit) || 50;
  const tilesPct = Math.min(100, Math.round((tilesUsed / Math.max(1, tilesLimit)) * 100));
  const historyUsed = Number(data?.ok && data.data.history_days) || 0;
  const historyLimit = Number(data?.ok && data.data.history_limit_days) || 30;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">auth · quota</span>}
        title="Quota"
        description="Plan limits and current usage. Read-only — upgrade from the pricing page when you need more."
        meta={
          <>
            <Badge
              variant="light"
              color={data?.ok ? "green" : "gray"}
              size="sm"
              radius="xl"
              leftSection={
                <StatusDot status={data?.ok ? "active" : "pending"} size="xs" pulse={data?.ok} />
              }
            >
              {data?.ok ? "Live" : "Loading"}
            </Badge>
            <Badge
              variant="light"
              color="violet"
              size="sm"
              radius="xl"
              leftSection={<KeyRound size={12} />}
            >
              {String(plan)}
            </Badge>
          </>
        }
        actions={
          <Button
            variant="default"
            size="sm"
            onClick={load}
            loading={loading}
            leftSection={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Tiles</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tabular-nums text-ink-1">
              {tilesUsed}
            </span>
            <span className="text-sm text-ink-3">/ {tilesLimit}</span>
          </div>
          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-[width]",
                tilesPct >= 90
                  ? "bg-status-danger"
                  : tilesPct >= 70
                    ? "bg-status-warn"
                    : "bg-accent",
              )}
              style={{ width: `${tilesPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-3">
            <span>{tilesPct}% used</span>
            <span>{Math.max(0, tilesLimit - tilesUsed)} remaining</span>
          </div>
          {tilesPct >= 80 ? (
            <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light" mt="sm">
              Approaching your tile limit. Upgrade for more capacity.
            </Alert>
          ) : null}
        </Card>

        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            History retention
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tabular-nums text-ink-1">
              {historyUsed}
            </span>
            <span className="text-sm text-ink-3">/ {historyLimit} days</span>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Events older than the retention window are pruned. Export before upgrading if you need
            them.
          </p>
          <div className="mt-3">
            <Link
              href="/dashboard/events"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <Gauge className="h-3 w-3" /> Open events log
            </Link>
          </div>
        </Card>
      </section>

      <Card>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Plan</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-accent-soft text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold capitalize text-ink-1">{String(plan)}</div>
            <p className="text-xs text-ink-3">
              {plan === "pro"
                ? "Unlimited tiles, 1y history, desktop sync, priority support."
                : "Up to 50 tiles, 30 days history."}
            </p>
          </div>
          <Button component={Link} href="/pricing" size="sm" leftSection={<CreditCard size={14} />}>
            {plan === "pro" ? "Manage subscription" : "Upgrade to Pro"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Session</div>
        {session?.ok ? (
          <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-surface-0 p-3 font-mono text-[11px] text-ink-1">
            {JSON.stringify(session.data, null, 2)}
          </pre>
        ) : session ? (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mt="sm">
            {session.error.kind} · {session.error.status} · {session.error.message}
          </Alert>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-3">
            <Loader size="xs" /> Loading session…
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
