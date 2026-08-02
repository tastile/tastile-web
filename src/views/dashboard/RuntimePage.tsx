"use client";

import { ENDPOINTS, type Result, getCoreClient } from "@/shared/api/endpoints";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { cn } from "@/shared/lib/cn";
import { Card, CardHeader } from "@/shared/ui/Card";
import { PageSummaryPanel } from "@/shared/ui/PageSummaryPanel";
import { StatusDot } from "@/shared/ui/StatusDot";
import { PageContainer, PageHeader } from "@/shared/ui/page-header/PageHeader";
import { Alert, Badge, Button, Loader, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Activity, CheckCircle2, Network, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface HealthData {
  status: string;
  version?: string;
  uptime_sec?: number;
  build?: string;
  commit?: string;
  started_at?: string;
}

interface RuntimePaths {
  data_dir?: string;
  events_path?: string;
  cache_dir?: string;
  log_dir?: string;
  config_path?: string;
}

interface VersionData {
  version: string;
  api_version?: string;
  build?: string;
  commit?: string;
  built_at?: string;
}

export default function Runtime() {
  const [health, setHealth] = useState<Result<HealthData> | null>(null);
  const [version, setVersion] = useState<Result<VersionData> | null>(null);
  const [paths, setPaths] = useState<Result<RuntimePaths> | null>(null);
  const [loading, setLoading] = useState(true);

  const sidePanel = useMemo(
    () => (
      <PageSummaryPanel
        title="Runtime"
        description="Live health, version, and storage paths of the local tastile-core daemon. The same daemon the desktop client talks to."
        sections={[
          {
            heading: "Health",
            items: [
              {
                label: "Status",
                value: health?.ok ? health.data.status : "—",
              },
              {
                label: "Version",
                value: version?.ok ? version.data.version : "—",
              },
              {
                label: "API",
                value: version?.ok ? (version.data.api_version ?? "—") : "—",
              },
            ],
          },
          {
            heading: "Related",
            items: [
              { label: "Events log", value: "→", href: "/dashboard/events" },
              { label: "API explorer", value: "→", href: "/dashboard/api" },
              { label: "Quota", value: "→", href: "/dashboard/quota" },
            ],
          },
        ]}
      />
    ),
    [health, version],
  );
  useSidePanel(sidePanel);

  const load = useCallback(() => {
    setLoading(true);
    const client = getCoreClient();
    return Promise.all([
      client.call<HealthData>("getHealth"),
      client.call<VersionData>("getVersion"),
      client.call<RuntimePaths>("getRuntimePaths"),
    ])
      .then(([h, v, p]) => {
        setHealth(h);
        setVersion(v);
        setPaths(p);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">tastile-core</span>}
        title="Runtime"
        description="Live health, version, and storage paths of the local tastile-core daemon. The same data the engine uses to verify itself."
        meta={
          <>
            <Badge
              variant="light"
              color={health?.ok ? "green" : health ? "red" : "gray"}
              size="sm"
              radius="xl"
              leftSection={
                <StatusDot
                  status={health?.ok ? "active" : health ? "danger" : "pending"}
                  pulse={health?.ok}
                  size="xs"
                />
              }
            >
              {health?.ok ? "Healthy" : health ? "Error" : "Loading"}
            </Badge>
            <Badge variant="light" color="gray" size="sm" radius="xl">
              {version?.ok ? `v${version.data.version}` : "—"}
            </Badge>
            <Badge
              variant="light"
              color="gray"
              size="sm"
              radius="xl"
              leftSection={<Network size={12} />}
            >
              {coreBaseUrl()}
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
        <Card>
          <CardHeader
            title="Health"
            description="Liveness & readiness from /health"
            action={<EndpointChip k="getHealth" />}
          />
          <div className="mt-4">
            {health === null ? (
              <LoadingRow label="Checking…" />
            ) : health.ok ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-status-active">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Healthy</span>
                </div>
                <dl className="space-y-1.5 text-xs">
                  <Row label="Status" value={String(health.data.status ?? "ok")} />
                  {health.data.uptime_sec !== undefined ? (
                    <Row label="Uptime" value={formatUptime(health.data.uptime_sec)} mono />
                  ) : null}
                  {health.data.build ? <Row label="Build" value={health.data.build} mono /> : null}
                </dl>
              </div>
            ) : (
              <ErrorRow error={health.error} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Version"
            description="Build info from /version"
            action={<EndpointChip k="getVersion" />}
          />
          <div className="mt-4">
            {version === null ? (
              <LoadingRow label="Checking…" />
            ) : version.ok ? (
              <dl className="space-y-1.5 text-xs">
                <Row label="Version" value={version.data.version} mono />
                {version.data.api_version ? (
                  <Row label="API" value={version.data.api_version} mono />
                ) : null}
                {version.data.commit ? (
                  <Row label="Commit" value={version.data.commit} mono />
                ) : null}
                {version.data.built_at ? (
                  <Row label="Built" value={version.data.built_at} mono />
                ) : null}
              </dl>
            ) : (
              <ErrorRow error={version.error} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Storage"
            description="Where data lives on disk"
            action={<EndpointChip k="getRuntimePaths" />}
          />
          <div className="mt-4">
            {paths === null ? (
              <LoadingRow label="Reading paths…" />
            ) : paths.ok ? (
              <ul className="space-y-1.5 text-xs">
                {Object.entries(paths.data).map(([k, v]) => (
                  <li key={k} className="grid grid-cols-[100px_1fr] items-center gap-2">
                    <span className="text-ink-3">{humanize(k)}</span>
                    <code className="truncate font-mono text-ink-1" title={String(v ?? "—")}>
                      {String(v ?? "—")}
                    </code>
                  </li>
                ))}
                {Object.keys(paths.data).length === 0 ? (
                  <li className="text-ink-4">No paths reported.</li>
                ) : null}
              </ul>
            ) : (
              <ErrorRow error={paths.error} />
            )}
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Health probes"
          description="Public endpoints that don't need auth. Useful for uptime checks and liveness."
        />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ProbeRow k="getHealth" label="Liveness" />
          <ProbeRow k="getReady" label="Readiness" />
          <ProbeRow k="getVersion" label="Build info" />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Daemon environment"
          description="What the web client talks to. Override with NEXT_PUBLIC_TASTILE_CORE_URL."
        />
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <EnvRow label="Base URL" value={coreBaseUrl()} />
          <EnvRow label="Auth" value="Cognito JWT · Bearer" />
          <EnvRow label="Token source" value="window.__tastileIdToken" />
          <EnvRow
            label="Spec"
            value={`OpenAPI 3.0.3 · ${Object.keys(ENDPOINTS).length} operations`}
          />
        </dl>
      </Card>
    </PageContainer>
  );
}

function ProbeRow({ k, label }: { k: keyof typeof ENDPOINTS; label: string }) {
  const [result, setResult] = useState<Result<unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    setResult(null);
    await getCoreClient()
      .call(k)
      .then((data) => {
        setResult(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }
  const meta = ENDPOINTS[k];
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface-0 p-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-ink-1">{label}</div>
        <code className="font-mono text-[10px] text-ink-3">
          {meta.method} {meta.path}
        </code>
      </div>
      <div className="flex items-center gap-2">
        {result ? (
          <Badge variant="light" color={result.ok ? "green" : "red"} size="sm" radius="xl">
            {result.ok
              ? `${result.status} ${result.latencyMs}ms`
              : `${result.error.status} ${result.error.kind}`}
          </Badge>
        ) : null}
        <Button
          variant="default"
          size="compact-sm"
          onClick={run}
          loading={loading}
          leftSection={!loading ? <Activity size={12} /> : undefined}
        >
          Probe
        </Button>
      </div>
    </div>
  );
}

function EndpointChip({ k }: { k: keyof typeof ENDPOINTS }) {
  const meta = ENDPOINTS[k];
  return (
    <code className="rounded border border-border bg-surface-0 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
      {meta.method} {meta.path}
    </code>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("truncate text-ink-1", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function EnvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-0 p-2.5">
      <span className="text-ink-3">{label}</span>
      <code className="truncate font-mono text-ink-1">{value}</code>
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-ink-3">
      <Loader size="xs" />
      {label}
    </div>
  );
}

function ErrorRow({ error }: { error: { kind: string; message: string; status: number } }) {
  return (
    <Alert
      icon={<IconAlertTriangle size={16} />}
      title={`${error.kind} · ${error.status}`}
      color="red"
      variant="light"
    >
      <Text size="xs" truncate>
        {error.message}
      </Text>
    </Alert>
  );
}

function humanize(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function coreBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL ?? process.env.NEXT_PUBLIC_DAEMON_BASE_URL ?? "";
  if (base) return base;
  if (process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1") return "http://127.0.0.1:31400";
  return "/api/proxy";
}
