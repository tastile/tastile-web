"use client";

import { type Result, getCoreClient } from "@/shared/api/endpoints";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Card } from "@/shared/ui/Card";
import { Dropdown } from "@/shared/ui/Dropdown";
import { EmptyState } from "@/shared/ui/Empty";
import { PageSummaryPanel } from "@/shared/ui/PageSummaryPanel";
import { PageContainer, PageHeader } from "@/shared/ui/page-header/PageHeader";
import { Alert, Badge, Button, Loader, Text, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  Download,
  Filter,
  RefreshCw,
  Search,
  Terminal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface DebugEvent {
  id: string;
  type: string;
  occurred_at: string;
  actor?: { kind: string; id?: string };
  tile_id?: string | null;
  payload?: unknown;
}

export default function Events() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<Result<
    { events: DebugEvent[]; count: number } | DebugEvent[]
  > | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    setEvents(null);
    return getCoreClient()
      .call<{ events: DebugEvent[]; count: number } | DebugEvent[]>("getDebugEvents")
      .then((result) => {
        setEvents(result);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const list: DebugEvent[] = useMemo(() => {
    if (!events?.ok) return [];
    const data = events.data;
    if (Array.isArray(data)) return data;
    return (data as { events: DebugEvent[] }).events ?? [];
  }, [events]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const e of list) {
      set.add(e.type);
    }
    return ["All", ...Array.from(set).sort()];
  }, [list]);

  const sidePanel = useMemo(
    () => (
      <PageSummaryPanel
        title={t("dashboard.events.title")}
        description={t("dashboard.events.description")}
        sections={[
          {
            heading: t("dashboard.events.sections.counts"),
            items: [
              { label: t("dashboard.events.labels.loaded"), value: list.length },
              { label: t("dashboard.events.labels.distinctTypes"), value: types.length - 1 },
              {
                label: t("dashboard.events.labels.filter"),
                value: typeFilter === "All" ? t("dashboard.events.allTypes") : typeFilter,
              },
            ],
          },
          {
            heading: t("dashboard.events.sections.related"),
            items: [
              { label: t("dashboard.events.labels.timeline"), value: "→", href: "/dashboard/timeline" },
              { label: t("dashboard.events.labels.runtime"), value: "→", href: "/dashboard/runtime" },
              { label: t("dashboard.events.labels.apiExplorer"), value: "→", href: "/dashboard/api" },
            ],
          },
        ]}
      />
    ),
    [list.length, types.length, typeFilter, t],
  );
  useSidePanel(sidePanel);

  const filtered = useMemo(() => {
    return list.filter((e) => {
      if (typeFilter !== "All" && e.type !== typeFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        e.type.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.actor?.id ?? "").toLowerCase().includes(q) ||
        (e.tile_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [list, query, typeFilter]);

  function downloadJson() {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tastile-events-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">{t("dashboard.events.eyebrow")}</span>}
        title={t("dashboard.events.title")}
        description={t("dashboard.events.description")}
        meta={
          <>
            <Badge
              variant="light"
              color={events?.ok ? "green" : "gray"}
              size="sm"
              radius="xl"
              leftSection={<Database size={12} />}
            >
              {t("dashboard.events.countLabel", { count: list.length })}
            </Badge>
            <Badge
              variant="light"
              color="gray"
              size="sm"
              radius="xl"
              leftSection={<Terminal size={12} />}
            >
              {t("dashboard.events.endpointPath")}
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="default"
              size="sm"
              onClick={downloadJson}
              disabled={!list.length}
              leftSection={<Download size={14} />}
            >
              {t("dashboard.events.downloadJson")}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={load}
              loading={loading}
              leftSection={<RefreshCw size={14} />}
            >
              {t("common.refresh")}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("dashboard.events.searchPlaceholder")}
          aria-label={t("dashboard.events.searchAria")}
          leftSection={<Search size={14} />}
          size="sm"
          className="flex-1"
        />
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-ink-3" />
          <Dropdown
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            size="medium"
            items={types.map((typeValue) => ({
              value: typeValue,
              label: typeValue === "All" ? t("dashboard.events.filterAll") : typeValue,
            }))}
            className="min-w-[120px]"
          />
        </div>
      </div>

      <Card padded={false}>
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-ink-3">
            <Loader size="xs" /> {t("dashboard.events.loading")}
          </div>
        ) : !events?.ok ? (
          <div className="p-6">
            <ErrorState error={events?.error} onRetry={load} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Database className="h-6 w-6" />}
              title={t("dashboard.events.empty.title")}
              description={t("dashboard.events.empty.body")}
            />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-0 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="w-20 px-2 py-2">{t("dashboard.events.table.type")}</th>
                <th className="px-2 py-2">{t("dashboard.events.table.id")}</th>
                <th className="px-2 py-2">{t("dashboard.events.table.actor")}</th>
                <th className="hidden px-2 py-2 md:table-cell">{t("dashboard.events.table.tile")}</th>
                <th className="px-2 py-2 text-right">{t("dashboard.events.table.when")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const isOpen = !!expanded[e.id];
                return (
                  <FragmentRow
                    key={e.id}
                    event={e}
                    isOpen={isOpen}
                    onToggle={() => setExpanded((m) => ({ ...m, [e.id]: !m[e.id] }))}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </PageContainer>
  );
}

function FragmentRow({
  event,
  isOpen,
  onToggle,
}: {
  event: DebugEvent;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <tr
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        className="cursor-pointer transition-colors hover:bg-surface-2"
      >
        <td className="px-2 py-1.5 align-top">
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-ink-3" />
          )}
        </td>
        <td className="px-2 py-1.5 align-top">
          <span className="inline-flex h-5 items-center rounded bg-accent-soft px-1.5 font-mono text-[10px] font-semibold text-accent">
            {event.type}
          </span>
        </td>
        <td className="px-2 py-1.5 align-top font-mono text-[11px] text-ink-1">
          <span className="line-clamp-1">{event.id}</span>
        </td>
        <td className="px-2 py-1.5 align-top text-xs text-ink-2">
          {event.actor ? `${event.actor.kind}${event.actor.id ? ` · ${event.actor.id}` : ""}` : "—"}
        </td>
        <td className="hidden px-2 py-1.5 align-top font-mono text-[11px] text-ink-3 md:table-cell">
          {event.tile_id ?? "—"}
        </td>
        <td className="px-2 py-1.5 text-right align-top font-mono text-[10px] text-ink-4">
          {formatRelative(event.occurred_at)}
        </td>
      </tr>
      {isOpen ? (
        <tr className="bg-surface-0">
          <td colSpan={6} className="px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              <Code2 className="h-3 w-3" /> {t("dashboard.events.payloadHeading")}
            </div>
            <pre className="max-h-80 overflow-auto rounded-md border border-border bg-surface-1 p-3 font-mono text-[11px] text-ink-1">
              {JSON.stringify(event.payload ?? {}, null, 2)}
            </pre>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <Field label={t("dashboard.events.detail.eventId")} value={event.id} />
              <Field label={t("dashboard.events.table.occurred")} value={event.occurred_at} />
              <Field label={t("dashboard.events.table.tile")} value={event.tile_id ?? "—"} />
              <Field
                label={t("dashboard.events.table.actor")}
                value={
                  event.actor
                    ? `${event.actor.kind}${event.actor.id ? ` · ${event.actor.id}` : ""}`
                    : "—"
                }
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-4">{label}</div>
      <div className="mt-0.5 truncate font-mono text-ink-1" title={value}>
        {value}
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error?: { kind: string; message: string; status: number };
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (!error) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        title={t("dashboard.events.empty.initialTitle")}
        description={t("dashboard.events.empty.initialBody")}
      />
    );
  }
  return (
    <Alert
      icon={<IconAlertCircle size={16} />}
      title={`${error.kind} · ${error.status}`}
      color="red"
      variant="light"
    >
      <Text size="sm" mb="sm">
        {error.message}
      </Text>
      <Button
        variant="subtle"
        size="compact-sm"
        onClick={onRetry}
        leftSection={<RefreshCw size={12} />}
      >
        {t("common.retry")}
      </Button>
    </Alert>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  if (diff < 0) return "future";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
