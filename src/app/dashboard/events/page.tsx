"use client";

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
import { PageSummaryPanel } from "@/components/panels/PageSummaryPanel";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/Empty";
import { getCoreClient, type Result } from "@/lib/api/endpoints";
import { useSidePanel } from "@/lib/context/side-panel-context";

interface DebugEvent {
  id: string;
  type: string;
  occurred_at: string;
  actor?: { kind: string; id?: string };
  tile_id?: string | null;
  payload?: unknown;
}

export default function EventsPage() {
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
    list.forEach((e) => {
      set.add(e.type);
    });
    return ["All", ...Array.from(set).sort()];
  }, [list]);

  const sidePanel = useMemo(
    () => (
      <PageSummaryPanel
        title="Events log"
        description="Raw fact stream. Append-only — there is no UPDATE on an event. Every state in the UI was derived from one of these."
        sections={[
          {
            heading: "Counts",
            items: [
              { label: "Loaded", value: list.length },
              { label: "Distinct types", value: types.length - 1 },
              {
                label: "Filter",
                value: typeFilter === "All" ? "all types" : typeFilter,
              },
            ],
          },
          {
            heading: "Related",
            items: [
              { label: "Timeline", value: "→", href: "/dashboard/timeline" },
              { label: "Runtime", value: "→", href: "/dashboard/runtime" },
              { label: "API explorer", value: "→", href: "/dashboard/api" },
            ],
          },
        ]}
      />
    ),
    [list.length, types.length, typeFilter],
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
        eyebrow={<span className="font-mono text-ink-3">append-only · debug</span>}
        title="Events log"
        description="The raw fact stream. Every state in the UI was derived from one of these. Append-only — there is no UPDATE on an event."
        meta={
          <>
            <Badge
              variant="light"
              color={events?.ok ? "green" : "gray"}
              size="sm"
              radius="xl"
              leftSection={<Database size={12} />}
            >
              {list.length} events
            </Badge>
            <Badge
              variant="light"
              color="gray"
              size="sm"
              radius="xl"
              leftSection={<Terminal size={12} />}
            >
              GET /debug/events
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
              Download JSON
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={load}
              loading={loading}
              leftSection={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by type, id, actor, tile…"
          aria-label="Search by type, id, actor, tile"
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
            items={types.map((t) => ({ value: t, label: t }))}
            className="min-w-[120px]"
          />
        </div>
      </div>

      <Card padded={false}>
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-ink-3">
            <Loader size="xs" /> Reading event log…
          </div>
        ) : !events?.ok ? (
          <div className="p-6">
            <ErrorState error={events?.error} onRetry={load} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Database className="h-6 w-6" />}
              title="No events match your filter"
              description="Loosen the search or switch the type filter back to All."
            />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-0 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="w-20 px-2 py-2">Type</th>
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Actor</th>
                <th className="hidden px-2 py-2 md:table-cell">Tile</th>
                <th className="px-2 py-2 text-right">When</th>
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
        className="cursor-pointer border-b border-border transition-colors hover:bg-surface-2"
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
        <tr className="border-b border-border bg-surface-0">
          <td colSpan={6} className="px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              <Code2 className="h-3 w-3" /> Payload
            </div>
            <pre className="max-h-80 overflow-auto rounded-md border border-border bg-surface-1 p-3 font-mono text-[11px] text-ink-1">
              {JSON.stringify(event.payload ?? {}, null, 2)}
            </pre>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <Field label="Event ID" value={event.id} />
              <Field label="Occurred" value={event.occurred_at} />
              <Field label="Tile" value={event.tile_id ?? "—"} />
              <Field
                label="Actor"
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
  if (!error) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        title="No events"
        description="Run a command on the engine to generate events."
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
        Retry
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
