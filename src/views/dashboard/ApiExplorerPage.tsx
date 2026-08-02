"use client";

import {
  type ApiTag,
  ENDPOINTS,
  ENDPOINTS_BY_TAG,
  type EndpointKey,
  type Result,
  TAG_ORDER,
  getCoreClient,
} from "@/shared/api/endpoints";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/Card";
import { PageSummaryPanel } from "@/shared/ui/PageSummaryPanel";
import { PageContainer, PageHeader } from "@/shared/ui/page-header/PageHeader";
import { ActionIcon, Alert, Badge, Button, Chip, Text, TextInput, Textarea } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { ChevronRight, Code2, Copy, Database, Lock, PlayCircle, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
const methodStyle: Record<Method, string> = {
  GET: "bg-status-active-soft text-status-active",
  POST: "bg-accent-soft text-accent",
  PUT: "bg-status-warn-soft text-status-warn",
  DELETE: "bg-status-danger-soft text-status-danger",
  PATCH: "bg-status-warn-soft text-status-warn",
};

export default function ApiExplorer() {
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<EndpointKey | null>(() => {
    if (typeof window === "undefined") return null;
    const focusParam = new URL(window.location.href).searchParams.get("focus");
    return focusParam && focusParam in ENDPOINTS ? (focusParam as EndpointKey) : null;
  });
  const [filterTag, setFilterTag] = useState<ApiTag | "All">(() => {
    if (typeof window === "undefined") return "All";
    const tagParam = new URL(window.location.href).searchParams.get("tag") as ApiTag | null;
    return tagParam && TAG_ORDER.includes(tagParam) ? tagParam : "All";
  });

  const sidePanel = useMemo(
    () => (
      <PageSummaryPanel
        title="API explorer"
        description="All endpoints grouped by tag. Click a row to inspect the request shape and try it against the live daemon."
        sections={[
          {
            heading: "Counts",
            items: [
              { label: "Endpoints", value: Object.keys(ENDPOINTS).length },
              { label: "Tags", value: TAG_ORDER.length },
              { label: "Tag filter", value: filterTag },
            ],
          },
          {
            heading: "Related",
            items: [
              { label: "Runtime", value: "→", href: "/dashboard/runtime" },
              { label: "Events log", value: "→", href: "/dashboard/events" },
              { label: "Quota", value: "→", href: "/dashboard/quota" },
            ],
          },
        ]}
      />
    ),
    [filterTag],
  );
  useSidePanel(sidePanel);

  const keys = (() => {
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
  })();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">tastile-core</span>}
        title="API explorer"
        description="Every core operation grouped by tag. Inspect request inputs and run it against your connected core."
        meta={
          <>
            <Badge
              variant="light"
              color="green"
              size="sm"
              radius="xl"
              leftSection={<Database size={12} />}
            >
              Live · {liveBaseUrl()}
            </Badge>
            <Badge variant="light" color="gray" size="sm" radius="xl">
              {Object.keys(ENDPOINTS).length} endpoints
            </Badge>
            <Badge variant="light" color="gray" size="sm" radius="xl">
              {TAG_ORDER.length} tags
            </Badge>
          </>
        }
        actions={
          <Button variant="default" size="sm" leftSection={<Code2 size={14} />}>
            Download OpenAPI
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search endpoints, paths, keywords…"
          aria-label="Search endpoints, paths, keywords"
          leftSection={<Search size={14} />}
          size="sm"
          className="flex-1"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            checked={filterTag === "All"}
            onChange={() => setFilterTag("All")}
            size="xs"
            variant="filled"
            radius="sm"
          >
            All
          </Chip>
          {TAG_ORDER.map((t) => (
            <Chip
              key={t}
              checked={filterTag === t}
              onChange={() => setFilterTag(t)}
              size="xs"
              variant="filled"
              radius="sm"
            >
              {t} {ENDPOINTS_BY_TAG[t].length}
            </Chip>
          ))}
        </div>
      </div>

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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setFocus(k);
                    }
                  }}
                  tabIndex={0}
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

      {focus ? (
        <EndpointDetail key={focus} endpointKey={focus} onClose={() => setFocus(null)} />
      ) : null}
    </PageContainer>
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
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryText, setQueryText] = useState("");
  const [bodyText, setBodyText] = useState<string>(
    meta.method === "GET" ? "" : defaultBody(endpointKey),
  );
  const placeholders = [...meta.path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);

  function run() {
    setRunning(true);
    setResponse(null);
    void executeApiCall(endpointKey, meta.method, {
      pathParams,
      queryText,
      bodyText,
    })
      .then((result) => {
        setResponse(result);
      })
      .catch((e: unknown) => {
        setResponse({
          ok: false,
          error: { kind: "validation", status: 0, message: (e as Error).message, body: null },
        });
      })
      .finally(() => {
        setRunning(false);
      });
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
        <ActionIcon variant="subtle" size="sm" onClick={onClose} aria-label="Close detail">
          <X size={14} />
        </ActionIcon>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
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

          {placeholders.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {placeholders.map((name) => (
                <div key={name} className="flex flex-col gap-1">
                  <label
                    htmlFor={`api-path-param-${name}`}
                    className="text-[10px] font-semibold uppercase tracking-wider text-ink-3"
                  >
                    Path: {name}
                  </label>
                  <TextInput
                    id={`api-path-param-${name}`}
                    value={pathParams[name] ?? ""}
                    onChange={(event) =>
                      setPathParams((current) => ({ ...current, [name]: event.target.value }))
                    }
                    placeholder={`{${name}}`}
                    size="xs"
                    styles={{ input: { fontFamily: "var(--font-geist-mono)" } }}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4">
            <label
              htmlFor="api-query-params"
              className="text-[10px] font-semibold uppercase tracking-wider text-ink-3"
            >
              Query parameters (optional JSON object)
            </label>
            <TextInput
              id="api-query-params"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder='{"limit": 20}'
              size="xs"
              mt={4}
              styles={{ input: { fontFamily: "var(--font-geist-mono)" } }}
            />
          </div>

          {meta.method !== "GET" ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                  Request body
                </span>
                <Button onClick={() => setBodyText(defaultBody(endpointKey))}>
                  <Text size="xs" c="dimmed">
                    Reset
                  </Text>
                </Button>
              </div>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                spellCheck={false}
                h={176}
                styles={{ input: { fontFamily: "var(--font-geist-mono)", fontSize: "11px" } }}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-border bg-surface-0 p-3 text-xs text-ink-3">
              GET request — no body required. Auth header is added automatically when required.
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="filled"
              size="sm"
              onClick={run}
              loading={running}
              disabled={running}
              leftSection={<PlayCircle size={14} />}
            >
              Run request
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => copyToClipboard(curlCommand(meta.method, meta.path, bodyText))}
              leftSection={<Copy size={14} />}
            >
              Copy as curl
            </Button>
            <span className="ml-auto font-mono text-[10px] text-ink-4">{endpointKey}</span>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Response
            </span>
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
              ? JSON.stringify(
                  response.ok ? response.data : (response.error.body ?? response.error),
                  null,
                  2,
                )
              : "// Click Run request to invoke this endpoint."}
          </pre>
          {response && !response.ok ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mt="sm">
              {response.error.message}
            </Alert>
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
            core: {
              id: "00000000-0000-0000-0000-000000000000",
              title: "Untitled",
              nextAction: null,
              doneDefinition: null,
              startedAt: null,
              completedAt: null,
            },
            work: { segments: [] },
            temporal: {
              tz: null,
              releaseAt: null,
              dueAt: null,
              fixedStart: null,
              fixedEnd: null,
              activeStart: null,
              activeEnd: null,
            },
            objective: {
              objectiveMode: "finish_once",
              targetWorkMin: 25,
              targetRestMin: null,
              doneRule: "manual",
              recurrence: null,
            },
            interruption: {
              interruptPenalty: 3,
              resumePenalty: 3,
              breakSplitsWork: true,
              externalInterruptOnly: false,
            },
            automation: {
              promptOnStart: false,
              promptOnEnd: true,
              autoStartAllowed: false,
              autoEndAllowed: false,
            },
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
      return JSON.stringify(
        { tile_id: "00000000-0000-0000-0000-000000000000", started_at: new Date().toISOString() },
        null,
        2,
      );
    case "startBreak":
      return JSON.stringify({ linked_tile_id: null, break_min: 5, reason: null }, null, 2);
    case "endBreak":
      return JSON.stringify({ tile_id: null, ended_at: new Date().toISOString() }, null, 2);
    case "requestPrompt":
      return JSON.stringify(
        { tile_id: null, requested_at: new Date().toISOString(), reason: "user_requested" },
        null,
        2,
      );
    case "respondStartupRecovery":
      return JSON.stringify(
        {
          prompt_id: "p-1",
          tile_id: "00000000-0000-0000-0000-000000000000",
          action: "confirm_continue",
          stop_at: null,
        },
        null,
        2,
      );
    case "attachMemo":
      return JSON.stringify(
        { tile_id: "00000000-0000-0000-0000-000000000000", body: "Quick note" },
        null,
        2,
      );
    case "tick":
    case "tickAt":
      return JSON.stringify({ at: new Date().toISOString() }, null, 2);
    case "tickRange":
      return JSON.stringify(
        { start: new Date().toISOString(), end: new Date(Date.now() + 3600_000).toISOString() },
        null,
        2,
      );
    default:
      return "{}";
  }
}

function curlCommand(method: string, path: string, body: string): string {
  const base = coreBaseUrl();
  const lines = [`curl -X ${method} '${base}${path}'`, `  -H 'accept: application/json'`];
  if (method !== "GET" && body.trim()) {
    lines.push(`  -H 'content-type: application/json'`);
    lines.push(`  -d '${body.replace(/'/g, "\\'")}'`);
  }
  return lines.join(" \\\n");
}

function coreBaseUrl(): string {
  return process.env.NEXT_PUBLIC_TASTILE_CORE_URL ?? process.env.NEXT_PUBLIC_DAEMON_BASE_URL ?? "";
}

function liveBaseUrl(): string {
  const base = coreBaseUrl();
  if (base) return base;
  if (process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1") return "http://127.0.0.1:31400";
  return "/api/proxy";
}

function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}

async function executeApiCall(
  endpointKey: EndpointKey,
  method: string,
  inputs: {
    pathParams: Record<string, string>;
    queryText: string;
    bodyText: string;
  },
): Promise<Result<unknown>> {
  const client = getCoreClient();
  const query = inputs.queryText.trim()
    ? (JSON.parse(inputs.queryText) as Record<string, string | number | boolean>)
    : undefined;
  const body = method !== "GET" && inputs.bodyText.trim() ? JSON.parse(inputs.bodyText) : undefined;
  return client.call(endpointKey, {
    pathParams: inputs.pathParams,
    query,
    body,
  });
}
