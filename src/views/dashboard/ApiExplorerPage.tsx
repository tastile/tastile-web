"use client";

import {
  type ApiTag,
  ENDPOINTS,
  ENDPOINTS_BY_TAG,
  type EndpointKey,
  type Result,
  TAG_ORDER,
  getCoreClient,
  resolveCoreBaseUrl,
} from "@/shared/api/endpoints";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { useTranslation } from "@/shared/i18n/use-translation";
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
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<EndpointKey | null>(null);
  const [filterTag, setFilterTag] = useState<ApiTag | "All">("All");

  const sidePanel = useMemo(
    () => (
      <PageSummaryPanel
        title={t("dashboard.api.title")}
        description={t("dashboard.api.description")}
        sections={[
          {
            heading: t("dashboard.api.sections.counts"),
            items: [
              { label: t("dashboard.api.labels.endpoints"), value: Object.keys(ENDPOINTS).length },
              { label: t("dashboard.api.labels.tags"), value: TAG_ORDER.length },
              { label: t("dashboard.api.labels.tagFilter"), value: filterTag },
            ],
          },
          {
            heading: t("dashboard.api.sections.related"),
            items: [
              { label: t("dashboard.api.labels.runtime"), value: "→", href: "/dashboard/runtime" },
              { label: t("dashboard.api.labels.eventsLog"), value: "→", href: "/dashboard/events" },
              { label: t("dashboard.api.labels.quota"), value: "→", href: "/dashboard/quota" },
            ],
          },
        ]}
      />
    ),
    [filterTag, t],
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
        eyebrow={<span className="font-mono text-ink-3">{t("dashboard.api.eyebrow")}</span>}
        title={t("dashboard.api.title")}
        description={t("dashboard.api.description")}
        meta={
          <>
            <Badge
              variant="light"
              color="green"
              size="sm"
              radius="xl"
              leftSection={<Database size={12} />}
            >
              {t("dashboard.api.liveBadge", { url: liveBaseUrl() })}
            </Badge>
            <Badge variant="light" color="gray" size="sm" radius="xl">
              {t("dashboard.api.endpointsLabel", { count: Object.keys(ENDPOINTS).length })}
            </Badge>
            <Badge variant="light" color="gray" size="sm" radius="xl">
              {t("dashboard.api.tagsLabel", { count: TAG_ORDER.length })}
            </Badge>
          </>
        }
        actions={
          <Button variant="default" size="sm" leftSection={<Code2 size={14} />}>
            {t("dashboard.api.downloadOpenApi")}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("dashboard.api.searchPlaceholder")}
          aria-label={t("dashboard.api.searchAria")}
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
            {t("dashboard.api.tagFilterAll")}
          </Chip>
          {TAG_ORDER.map((tag) => (
            <Chip
              key={tag}
              checked={filterTag === tag}
              onChange={() => setFilterTag(tag)}
              size="xs"
              variant="filled"
              radius="sm"
            >
              {t("dashboard.api.tagFilterWithCount", { tag, count: ENDPOINTS_BY_TAG[tag].length })}
            </Chip>
          ))}
        </div>
      </div>

      <Card padded={false}>
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-surface-0">
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              <th className="w-20 px-3 py-2">{t("dashboard.api.table.method")}</th>
              <th className="px-3 py-2">{t("dashboard.api.table.path")}</th>
              <th className="px-3 py-2">{t("dashboard.api.table.summary")}</th>
              <th className="hidden w-24 px-3 py-2 md:table-cell">{t("dashboard.api.table.tag")}</th>
              <th className="hidden w-16 px-3 py-2 text-right md:table-cell">
                {t("dashboard.api.table.auth")}
              </th>
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
                    "cursor-pointer transition-colors",
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
                      <span className="text-[10px] text-ink-4">{t("dashboard.api.publicLabel")}</span>
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
                  {t("dashboard.api.empty")}
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
  const { t } = useTranslation();
  const meta = ENDPOINTS[endpointKey];
  const [response, setResponse] = useState<Result<unknown> | null>(null);
  const [running, setRunning] = useState(false);
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryText, setQueryText] = useState("");
  const [bodyText, setBodyText] = useState<string>(
    meta.method === "GET" ? "" : defaultBody(endpointKey, t),
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
      <div className="flex items-center justify-between bg-surface-0 px-4 py-3">
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
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={onClose}
          aria-label={t("dashboard.api.closeDetailAria")}
        >
          <X size={14} />
        </ActionIcon>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="bg-surface-0 p-4">
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
              <span className="inline-flex items-center gap-1 rounded bg-status-warn-soft px-1.5 py-0.5 text-[10px] font-medium text-status-warn">
                <Lock className="h-2.5 w-2.5" />
                {t("dashboard.api.authRequired")}
              </span>
            ) : (
              <span className="rounded bg-status-active-soft px-1.5 py-0.5 text-[10px] font-medium text-status-active">
                {t("dashboard.api.publicLabel")}
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
                    {t("dashboard.api.pathLabel", { name })}
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
              {t("dashboard.api.queryLabel")}
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
                  {t("dashboard.api.bodyLabel")}
                </span>
                <Button onClick={() => setBodyText(defaultBody(endpointKey, t))}>
                  <Text size="xs" c="dimmed">
                    {t("common.reset")}
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
            <div className="mt-4 rounded-md border border-border bg-surface-0 p-3 text-xs text-ink-3">
              {t("dashboard.api.getNoBody")}
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
              {t("dashboard.api.runRequest")}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => copyToClipboard(curlCommand(meta.method, meta.path, bodyText))}
              leftSection={<Copy size={14} />}
            >
              {t("dashboard.api.copyAsCurl")}
            </Button>
            <span className="ml-auto font-mono text-[10px] text-ink-4">{endpointKey}</span>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              {t("dashboard.api.responseLabel")}
            </span>
            {response ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[10px]",
                  response.ok
                    ? "bg-status-active-soft text-status-active"
                    : "bg-status-danger-soft text-status-danger",
                )}
              >
                {response.ok ? response.status : response.error.status}{" "}
                {response.ok ? t("dashboard.api.statusOk") : response.error.kind}
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
              : t("dashboard.api.responsePlaceholder")}
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

function defaultBody(
  k: EndpointKey,
  t: (key: string) => string,
): string {
  switch (k) {
    case "createTile":
      return JSON.stringify(
        {
          tile_id: "00000000-0000-0000-0000-000000000000",
          tile: {
            core: {
              id: "00000000-0000-0000-0000-000000000000",
              title: t("dashboard.api.placeholderTileTitle"),
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
        { tile_id: "00000000-0000-0000-0000-000000000000", body: t("dashboard.api.placeholderMemoBody") },
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
  return resolveCoreBaseUrl();
}

function liveBaseUrl(): string {
  return resolveCoreBaseUrl();
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
