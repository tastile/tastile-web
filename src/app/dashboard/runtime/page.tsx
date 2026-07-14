"use client";

import { Activity, AlertTriangle, CheckCircle2, Loader2, Network, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageSummaryPanel } from "@/components/panels/PageSummaryPanel";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill, StatusDot } from "@/components/ui/StatusDot";
import { ENDPOINTS, getCoreClient, type Result } from "@/lib/api/endpoints";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { cn } from "@/lib/utils/cn";

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

export default function RuntimePage() {
  const [health, setHealth] = useState<Result<HealthData> | null>(null);
  const [version, setVersion] = useState<Result<VersionData> | null>(null);
  const [paths, setPaths] = useState<Result<RuntimePaths> | null>(null);
  const [loading, setLoading] = useState(false);

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

  const load = useCallback(async () => {
    setLoading(true);
    const client = getCoreClient();
    const [h, v, p] = await Promise.all([
      client.call<HealthData>("getHealth"),
      client.call<VersionData>("getVersion"),
      client.call<RuntimePaths>("getRuntimePaths"),
    ]);
    setHealth(h);
    setVersion(v);
    setPaths(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">tastile-core</span>}
        title="Runtime"
        description="Live health, version, and storage paths of the local tastile-core daemon. The same data the engine uses to verify itself."
        meta={
          <>
            <Pill variant={health?.ok ? "active" : "default"}>
              <StatusDot
                status={health?.ok ? "active" : health ? "danger" : "pending"}
                pulse={health?.ok}
                size="xs"
              />
              {health?.ok ? "Healthy" : health ? "Error" : "Loading"}
            </Pill>
            <Pill variant="default">{version?.ok ? `v${version.data.version}` : "—"}</Pill>
            <Pill variant="default">
              <Network className="h-3 w-3" />
              {coreBaseUrl()}
            </Pill>
          </>
        }
        actions={
          <Button variant="secondary" size="medium" onClick={load} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
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
    setResult(await getCoreClient().call(k));
    setLoading(false);
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
          <Pill variant={result.ok ? "active" : "danger"}>
            {result.ok
              ? `${result.status} ${result.latencyMs}ms`
              : `${result.error.status} ${result.error.kind}`}
          </Pill>
        ) : null}
        <Button variant="secondary" size="small" onClick={run} loading={loading}>
          {loading ? null : <Activity className="h-3 w-3" />}
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
      <Loader2 className="h-3 w-3 animate-spin" />
      {label}
    </div>
  );
}

function ErrorRow({ error }: { error: { kind: string; message: string; status: number } }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-status-danger/30 bg-status-danger-soft p-2.5 text-xs text-status-danger">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-semibold">
          {error.kind} · {error.status}
        </div>
        <div className="truncate">{error.message}</div>
      </div>
    </div>
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
  return (
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL ??
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL ??
    "http://127.0.0.1:31400"
  );
}
