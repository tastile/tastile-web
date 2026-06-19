"use client";

import {
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Filter,
  Lock,
  PlayCircle,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/StatusDot";
import {
  ENDPOINTS,
  ENDPOINTS_BY_TAG,
  TAG_ORDER,
  type ApiTag,
  type EndpointKey,
  getCoreClient,
  type Result,
} from "@/lib/api/endpoints";
import { cn } from "@/lib/utils/cn";

type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
const methodStyle: Record<Method, string> = {
  GET: "bg-status-active-soft text-status-active",
  POST: "bg-accent-soft text-accent",
  PUT: "bg-status-warn-soft text-status-warn",
  DELETE: "bg-status-danger-soft text-status-danger",
  PATCH: "bg-status-warn-soft text-status-warn",
};

export default function ApiExplorerPage() {
  const [query, setQuery] = useState("");
  const [filterTag, setFilterTag] = useState<ApiTag | "All">("All");
  const [focus, setFocus] = useState<EndpointKey | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read ?focus=… and ?tag=… once on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read URL once on mount
    setHydrated(true);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const focusParam = url.searchParams.get("focus");
    const tagParam = url.searchParams.get("tag") as ApiTag | null;
    if (focusParam && focusParam in ENDPOINTS) {
      setFocus(focusParam as EndpointKey);
    } else if (tagParam && TAG_ORDER.includes(tagParam)) {
      setFilterTag(tagParam);
    }
  }, []);

  const keys = useMemo(() => {
    const all = Object.keys(ENDPOINTS) as EndpointKey[];
    return all.filter((k) => {
      if (filterTag !== "All" && ENDPOINTS[k].tag !== filterTag) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const m = ENDPOINTS[k];
      return (
        m.summary.toLowerCase().includes(q) ||
        m.path.toLowerCase().includes(q) ||
        m.keywords.some((kw) => kw.toLowerCase().includes(q)) ||
        m.tag.toLowerCase().includes(q)
      );
    });
  }, [query, filterTag]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">tastile-core</span>}
        title="API explorer"
        description="All 45 endpoints grouped by tag. Click any row to inspect the request shape and try it against your local daemon."
        meta={
          <>
            <Pill variant="active">
              <Database className="h-3 w-3" />
              Live · http://127.0.0.1:3140
            </Pill>
            <Pill variant="default">{Object.keys(ENDPOINTS).length} endpoints</Pill>
            <Pill variant="default">{TAG_ORDER.length} tags</Pill>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="md">
              <Code2 className="h-3.5 w-3.5" />
              Download OpenAPI
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search endpoints, paths, keywords…"
            className="h-9 w-full rounded-md border border-border bg-surface-1 pl-8 pr-3 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-accent focus:ring-2 focus:ring-focus"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={filterTag === "All"} onClick={() => setFilterTag("All")}>
            All
          </FilterChip>
          {TAG_ORDER.map((t) => (
            <FilterChip
              key={t}
              active={filterTag === t}
              onClick={() => setFilterTag(t)}
              count={ENDPOINTS_BY_TAG[t].length}
            >
              {t}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Endpoint table */}
      <Card padded={false}>
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-surface-0">
            <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              <th className="w-20 px-3 py-2">Method</th>
              <th className="px-3 py-2">Path</th>
              <th className="px-3 py-2">Summary</th>
              <th className="hidden w-24 px-3 py-2 md:table-cell">Tag</th>
              <th className="hidden w-16 px-3 py-2 text-right md:table-cell">Auth</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const m = ENDPOINTS[k];
              const isFocused = focus === k;
              return (
                <tr
                  key={k}
                  onClick={() => setFocus(k)}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors",
                    isFocused ? "bg-accent-soft" : "hover:bg-surface-2",
                  )}
                >
                  <td className="px-3 py-1.5">
                    <span
                      className={cn(
                        "inline-flex h-5 w-fit items-center justify-center rounded px-1.5 font-mono text-[10px] font-bold",
                        methodStyle[m.method as Method],
                      )}
                    >
                      {m.method}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <code className="font-mono text-xs text-ink-1">{m.path}</code>
                  </td>
                  <td className="truncate px-3 py-1.5 text-ink-2">{m.summary}</td>
                  <td className="hidden px-3 py-1.5 md:table-cell">
                    <span className="rounded border border-border bg-surface-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-3">
                      {m.tag}
                    </span>
                  </td>
                  <td className="hidden px-3 py-1.5 text-right md:table-cell">
                    {m.auth ? (
                      <Lock className="ml-auto h-3 w-3 text-ink-3" />
                    ) : (
                      <span className="text-[10px] text-ink-4">public</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-ink-4" />
                  </td>
                </tr>
              );
            })}
            {keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-sm text-ink-4">
                  No endpoints match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {/* Detail */}
      {focus ? <EndpointDetail key={focus} endpointKey={focus} onClose={() => setFocus(null)} /> : null}
    </PageContainer>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface-1 text-ink-2 hover:border-border-strong hover:text-ink-1",
      )}
    >
      {children}
      {typeof count === "number" ? (
        <span
          className={cn(
            "rounded px-1 font-mono text-[10px]",
            active ? "bg-accent/15 text-accent" : "bg-surface-2 text-ink-3",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function EndpointDetail({
  endpointKey,
  onClose,
}: {
  endpointKey: EndpointKey;
  onClose: () => void;
}) {
  const meta = ENDPOINTS[endpointKey];
  const [response, setResponse] = useState<Result<unknown> | null>(null);
  const [running, setRunning] = useState(false);
  const [bodyText, setBodyText] = useState<string>(
    meta.method === "POST" ? defaultBody(endpointKey) : "",
  );

  async function run() {
    setRunning(true);
    setResponse(null);
    try {
      const client = getCoreClient();
      const body = meta.method === "POST" && bodyText.trim() ? JSON.parse(bodyText) : undefined;
      const result = await client.call(endpointKey, { body });
      setResponse(result);
    } catch (e) {
      setResponse({
        ok: false,
        error: { kind: "validation", status: 0, message: (e as Error).message, body: null },
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-0 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] font-bold",
              methodStyle[meta.method as Method],
            )}
          >
            {meta.method}
          </span>
          <code className="font-mono text-sm text-ink-1">{meta.path}</code>
          <span className="rounded border border-border bg-surface-1 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-3">
            {meta.tag}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink-1"
          aria-label="Close detail"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Left: meta + body */}
        <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
          <h3 className="text-sm font-semibold text-ink-1">{meta.summary}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {meta.keywords.map((k) => (
              <span
                key={k}
                className="rounded border border-border bg-surface-0 px-1.5 py-0.5 text-[10px] text-ink-3"
              >
                {k}
              </span>
            ))}
            {meta.auth ? (
              <span className="inline-flex items-center gap-1 rounded border border-status-warn/30 bg-status-warn-soft px-1.5 py-0.5 text-[10px] font-medium text-status-warn">
                <Lock className="h-2.5 w-2.5" />
                auth required
              </span>
            ) : (
              <span className="rounded border border-status-active/30 bg-status-active-soft px-1.5 py-0.5 text-[10px] font-medium text-status-active">
                public
              </span>
            )}
          </div>

          {meta.method === "POST" ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                  Request body
                </label>
                <button
                  type="button"
                  onClick={() => setBodyText(defaultBody(endpointKey))}
                  className="text-[10px] text-ink-4 hover:text-ink-2"
                >
                  Reset
                </button>
              </div>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                spellCheck={false}
                className="h-44 w-full rounded-md border border-border bg-surface-0 p-2 font-mono text-[11px] text-ink-1 outline-none focus:border-accent focus:ring-2 focus:ring-focus"
              />
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-border bg-surface-0 p-3 text-xs text-ink-3">
              GET request — no body required. Auth header is added automatically when required.
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <Button variant="primary" size="md" onClick={run} loading={running} disabled={running}>
              <PlayCircle className="h-3.5 w-3.5" />
              Run request
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => copyToClipboard(curlCommand(meta.method, meta.path, bodyText))}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy as curl
            </Button>
            <span className="ml-auto font-mono text-[10px] text-ink-4">
              {endpointKey}
            </span>
          </div>
        </div>

        {/* Right: response */}
        <div className="p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Response
            </label>
            {response ? (
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                  response.ok
                    ? "border-status-active/30 bg-status-active-soft text-status-active"
                    : "border-status-danger/30 bg-status-danger-soft text-status-danger",
                )}
              >
                {response.ok ? response.status : response.error.status}{" "}
                {response.ok ? "OK" : response.error.kind}
                {response.ok ? ` · ${response.latencyMs}ms` : ""}
              </span>
            ) : null}
          </div>
          <pre className="min-h-[12rem] overflow-auto rounded-md border border-border bg-surface-0 p-2 font-mono text-[11px] text-ink-1">
            {response
              ? JSON.stringify(response.ok ? response.data : response.error.body ?? response.error, null, 2)
              : "// Click Run request to invoke this endpoint."}
          </pre>
          {response && !response.ok ? (
            <div className="mt-2 rounded-md border border-status-danger/30 bg-status-danger-soft p-2 text-xs text-status-danger">
              {response.error.message}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function defaultBody(k: EndpointKey): string {
  switch (k) {
    case "createTile":
      return JSON.stringify(
        {
          tile_id: "00000000-0000-0000-0000-000000000000",
          tile: {
            core: { id: "00000000-0000-0000-0000-000000000000", title: "Untitled", nextAction: null, doneDefinition: null, startedAt: null, completedAt: null },
            work: { segments: [] },
            temporal: { tz: null, releaseAt: null, dueAt: null, fixedStart: null, fixedEnd: null, activeStart: null, activeEnd: null },
            objective: { objectiveMode: "finish_once", targetWorkMin: 25, targetRestMin: null, doneRule: "manual", recurrence: null },
            interruption: { interruptPenalty: 3, resumePenalty: 3, breakSplitsWork: true, externalInterruptOnly: false },
            automation: { promptOnStart: false, promptOnEnd: true, autoStartAllowed: false, autoEndAllowed: false },
            annotation: { semanticRole: "work", labels: [], timedLabels: [] },
          },
        },
        null,
        2,
      );
    case "startTile":
    case "completeTile":
    case "deferTile":
    case "deleteTile":
    case "extendTile":
      return JSON.stringify({ tile_id: "00000000-0000-0000-0000-000000000000", started_at: new Date().toISOString() }, null, 2);
    case "startBreak":
      return JSON.stringify({ linked_tile_id: null, break_min: 5, reason: null }, null, 2);
    case "endBreak":
      return JSON.stringify({ tile_id: null, ended_at: new Date().toISOString() }, null, 2);
    case "requestPrompt":
      return JSON.stringify({ tile_id: null, requested_at: new Date().toISOString(), reason: "user_requested" }, null, 2);
    case "respondStartupRecovery":
      return JSON.stringify({ prompt_id: "p-1", tile_id: "00000000-0000-0000-0000-000000000000", action: "confirm_continue", stop_at: null }, null, 2);
    case "attachMemo":
      return JSON.stringify({ tile_id: "00000000-0000-0000-0000-000000000000", body: "Quick note" }, null, 2);
    case "tick":
    case "tickAt":
      return JSON.stringify({ at: new Date().toISOString() }, null, 2);
    case "tickRange":
      return JSON.stringify({ start: new Date().toISOString(), end: new Date(Date.now() + 3600_000).toISOString() }, null, 2);
    default:
      return "{}";
  }
}

function curlCommand(method: string, path: string, body: string): string {
  const base = process.env.NEXT_PUBLIC_TASTILE_CORE_URL ?? "http://127.0.0.1:3140";
  const lines = [`curl -X ${method} '${base}${path}'`, `  -H 'accept: application/json'`];
  if (method !== "GET" && body.trim()) {
    lines.push(`  -H 'content-type: application/json'`);
    lines.push(`  -d '${body.replace(/'/g, "\\'")}'`);
  }
  return lines.join(" \\\n");
}

function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}
