"use client";

import { Calendar, CalendarDays, Coffee, Database, Loader2, PinIcon, Timer } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { CalendarSidePanel } from "@/components/panels/CalendarSidePanel";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill, StatusDot } from "@/components/ui/StatusDot";
import { ENDPOINTS, type EndpointKey, getCoreClient, type Result } from "@/lib/api/endpoints";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { cn } from "@/lib/utils/cn";

const VIEWS = ["day", "week", "month", "year"] as const;
type ViewKey = (typeof VIEWS)[number];

const endpointByView: Record<ViewKey, EndpointKey> = {
  day: "getCalendarDay",
  week: "getCalendarWeek",
  month: "getCalendarMonth",
  year: "getCalendarYear",
};

const rangeLabel: Record<ViewKey, string> = {
  day: "24h",
  week: "7d",
  month: "30d",
  year: "12mo",
};

export default function CalendarViewPage() {
  const router = useRouter();
  const params = useParams<{ view: string }>();
  const view = (VIEWS as readonly string[]).includes(params.view)
    ? (params.view as ViewKey)
    : "day";
  const endpoint = endpointByView[view];

  // anchor: カレンダーの選択日 (YYYY-MM-DD)
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));

  // サイドパネルを登録 — content をメモ化しないと毎レンダーで新規 JSX が
  // 作られ、useSidePanel → setContent → 親再描画 → ページ再描画のループが
  // "Maximum update depth exceeded" を起こす
  const sidePanel = useMemo(
    () => <CalendarSidePanel anchor={anchor} view={view} onSelectDate={setAnchor} />,
    [anchor, view],
  );
  useSidePanel(sidePanel);

  const [data, setData] = useState<Result<unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setData(null);
      const result = await getCoreClient().call(endpoint);
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const blocks = useMemo<CalendarBlock[]>(() => {
    if (!data?.ok || !data.data) return [];
    const payload = data.data as Record<string, unknown>;
    if (Array.isArray(payload)) return payload as CalendarBlock[];
    if (Array.isArray(payload.blocks)) return payload.blocks as CalendarBlock[];
    if (Array.isArray(payload.items)) return payload.items as CalendarBlock[];
    if (Array.isArray(payload.days)) {
      const out: CalendarBlock[] = [];
      for (const day of payload.days as Array<{ blocks?: CalendarBlock[] }>) {
        for (const b of day.blocks ?? []) out.push(b);
      }
      return out;
    }
    if (Array.isArray(payload.months)) {
      const out: CalendarBlock[] = [];
      for (const m of payload.months as Array<{ days?: Array<{ blocks?: CalendarBlock[] }> }>) {
        for (const day of m.days ?? []) {
          for (const b of day.blocks ?? []) out.push(b);
        }
      }
      return out;
    }
    return [];
  }, [data]);

  const summary = useMemo(() => {
    const work = blocks.filter((b) => b.type === "work").length;
    const brk = blocks.filter((b) => b.type === "break").length;
    const fixed = blocks.filter((b) => b.type === "fixed").length;
    return { work, brk: brk, fixed, total: blocks.length };
  }, [blocks]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">views · calendar · {view}</span>}
        title={view[0].toUpperCase() + view.slice(1)}
        description={descriptionFor(view)}
        meta={
          <>
            <Pill variant="accent">
              <CalendarDays className="h-3 w-3" />
              {rangeLabel[view]}
            </Pill>
            <Pill variant="default">
              <Database className="h-3 w-3" />
              GET {ENDPOINTS[endpoint].path}
            </Pill>
            <Pill variant="default">{summary.total} blocks</Pill>
          </>
        }
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface-1 p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => router.push(`/dashboard/calendar/${v}`)}
                className={cn(
                  "h-7 rounded px-2 text-xs font-medium transition-colors",
                  v === view ? "bg-surface-3 text-ink-1" : "text-ink-3 hover:text-ink-1",
                )}
                aria-pressed={v === view}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Work"
          value={summary.work}
          icon={<Timer className="h-3.5 w-3.5" />}
          tone="accent"
        />
        <SummaryCard
          label="Breaks"
          value={summary.brk}
          icon={<Coffee className="h-3.5 w-3.5" />}
          tone="warn"
        />
        <SummaryCard
          label="Fixed"
          value={summary.fixed}
          icon={<PinIcon className="h-3.5 w-3.5" />}
          tone="active"
        />
        <SummaryCard
          label="Total"
          value={summary.total}
          icon={<Calendar className="h-3.5 w-3.5" />}
          tone="default"
        />
      </section>

      <Card padded={false}>
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading {view} view…
          </div>
        ) : !data?.ok ? (
          <div className="p-6 text-sm text-status-danger">
            {data?.error.kind} · {data?.error.status} · {data?.error.message}
          </div>
        ) : blocks.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-4">
            <Calendar className="mx-auto mb-2 h-6 w-6" />
            No blocks in this {view}.
            <div className="mt-3">
              <Link
                href="/dashboard/tiles?action=new"
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-fg"
              >
                Create a tile
              </Link>
            </div>
          </div>
        ) : view === "day" ? (
          <DayGrid blocks={blocks} />
        ) : view === "week" ? (
          <WeekGrid blocks={blocks} />
        ) : view === "month" ? (
          <MonthGrid blocks={blocks} />
        ) : (
          <YearGrid blocks={blocks} />
        )}
      </Card>

      <Card>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
          Raw response
        </div>
        <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-surface-0 p-3 font-mono text-[11px] text-ink-1">
          {data?.ok ? JSON.stringify(data.data, null, 2) : "// request pending or failed"}
        </pre>
      </Card>
    </PageContainer>
  );
}

interface CalendarBlock {
  id?: string;
  title: string;
  type: "work" | "break" | "fixed" | string;
  startAt: string | Date;
  endAt: string | Date | null;
  durationMin?: number;
  status?: "done" | "active" | "scheduled" | string;
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "accent" | "warn" | "active" | "default";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-1 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
        {icon}
        {label}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-3xl font-semibold tabular-nums text-ink-1">{value}</span>
        <StatusDot
          status={
            tone === "accent"
              ? "active"
              : tone === "warn"
                ? "warn"
                : tone === "active"
                  ? "started"
                  : "neutral"
          }
          size="xs"
        />
      </div>
    </div>
  );
}

function DayGrid({ blocks }: { blocks: CalendarBlock[] }) {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <div className="grid grid-cols-[60px_1fr]">
      <div className="border-b border-border bg-surface-0" />
      <div className="border-b border-border bg-surface-0 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
        Today
      </div>
      {hours.map((h) => (
        <Fragment key={h}>
          <div className="border-b border-border bg-surface-0 px-3 py-3 text-right font-mono text-[10px] text-ink-4">
            {h.toString().padStart(2, "0")}:00
          </div>
          <div className="relative min-h-[44px] border-b border-border px-4 py-1.5">
            {blocks
              .filter((b) => new Date(b.startAt).getHours() === h)
              .map((b, i) => (
                <BlockChip key={(b.id ?? b.title) + i} block={b} />
              ))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function WeekGrid({ blocks }: { blocks: CalendarBlock[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + i);
    return d;
  });
  return (
    <div className="grid grid-cols-7">
      {days.map((d) => {
        const dayBlocks = blocks.filter((b) => sameDay(new Date(b.startAt), d));
        return (
          <div key={d.toISOString()} className="border-r border-border last:border-r-0">
            <div className="border-b border-border bg-surface-0 px-3 py-2 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="font-mono text-lg font-semibold tabular-nums text-ink-1">
                {d.getDate()}
              </div>
            </div>
            <div className="space-y-1 p-2">
              {dayBlocks.map((b, i) => (
                <BlockChip key={(b.id ?? b.title) + i} block={b} compact />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthGrid({ blocks }: { blocks: CalendarBlock[] }) {
  const first = new Date();
  first.setDate(1);
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() - first.getDay() + i);
    return d;
  });
  return (
    <div className="grid grid-cols-7">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
        <div
          key={w}
          className="border-b border-r border-border bg-surface-0 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3"
        >
          {w}
        </div>
      ))}
      {days.map((d) => {
        const dayBlocks = blocks.filter((b) => sameDay(new Date(b.startAt), d));
        const isCurrentMonth = d.getMonth() === new Date().getMonth();
        return (
          <div
            key={d.toISOString()}
            className={cn(
              "min-h-[80px] border-b border-r border-border p-1.5",
              !isCurrentMonth && "bg-surface-0",
            )}
          >
            <div
              className={cn(
                "font-mono text-[11px] tabular-nums",
                isCurrentMonth ? "text-ink-1" : "text-ink-4",
              )}
            >
              {d.getDate()}
            </div>
            <div className="mt-1 space-y-0.5">
              {dayBlocks.slice(0, 3).map((b, i) => (
                <BlockChip key={(b.id ?? b.title) + i} block={b} compact dense />
              ))}
              {dayBlocks.length > 3 ? (
                <div className="text-[9px] text-ink-4">+{dayBlocks.length - 3} more</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function YearGrid({ blocks }: { blocks: CalendarBlock[] }) {
  const months = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
      {months.map((m) => {
        const monthBlocks = blocks.filter((b) => new Date(b.startAt).getMonth() === m);
        const work = monthBlocks.filter((b) => b.type === "work").length;
        const brk = monthBlocks.filter((b) => b.type === "break").length;
        return (
          <div
            key={m}
            className="flex flex-col gap-1 rounded-md border border-border bg-surface-0 p-3"
          >
            <div className="text-xs font-semibold text-ink-1">
              {new Date(2000, m, 1).toLocaleDateString(undefined, { month: "long" })}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-ink-3">
              <span className="font-mono">{work}</span>
              <span>work</span>
              <span className="text-ink-4">·</span>
              <span className="font-mono">{brk}</span>
              <span>breaks</span>
            </div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="bg-accent" style={{ width: `${Math.min(100, work * 10)}%` }} />
              <div className="bg-status-warn" style={{ width: `${Math.min(100, brk * 10)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlockChip({
  block,
  compact = false,
  dense = false,
}: {
  block: CalendarBlock;
  compact?: boolean;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border",
        block.type === "work"
          ? "border-accent/30 bg-accent-soft text-accent"
          : block.type === "break"
            ? "border-status-warn/30 bg-status-warn-soft text-status-warn"
            : "border-status-active/30 bg-status-active-soft text-status-active",
        compact ? (dense ? "px-1.5 py-0.5" : "px-2 py-1") : "px-2.5 py-1.5",
      )}
    >
      <div className={cn("truncate font-medium", compact && dense ? "text-[10px]" : "text-xs")}>
        {block.title}
      </div>
      {!compact ? (
        <div className="mt-0.5 font-mono text-[10px] opacity-80">
          {formatTime(new Date(block.startAt))} · {block.durationMin ?? "—"}m
        </div>
      ) : null}
    </div>
  );
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function descriptionFor(v: ViewKey): string {
  switch (v) {
    case "day":
      return "24 hours, hour-by-hour. Best for the live view.";
    case "week":
      return "Seven days, grouped by work block density.";
    case "month":
      return "30 days, full month grid with work/break/fixed legend.";
    case "year":
      return "12 months, useful for retrospective review.";
  }
}
