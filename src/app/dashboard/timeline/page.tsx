"use client";

import { Calendar, ChevronRight, Coffee, ListChecks, Loader2, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TimelineSidePanel } from "@/components/panels/CalendarSidePanel";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill, StatusDot } from "@/components/ui/StatusDot";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { buildTimelineView, parseCustomRangeBoundary } from "@/lib/core/dashboard-workspace";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";
import { cn } from "@/lib/utils/cn";

export default function TimelinePage() {
  const { state, loading } = useExecutionEngineContext();
  const { timelineScale, customStartIso, customEndIso, setTimelineScale, setCustomRange } =
    useDashboardWorkspaceStorePlaceholder();
  const [nowMs, setNowMs] = useState<number | null>(null);
  // anchor: ミニカレンダーの選択日
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));

  // 日付クリック時: custom range に切り替えてその日を表示
  function handleSelectDate(date: string) {
    setAnchor(date);
    setTimelineScale("custom");
    setCustomRange(date, null);
  }

  // サイドパネルを登録
  useSidePanel(
    <TimelineSidePanel
      anchor={anchor}
      scale={timelineScale}
      onSelectDate={handleSelectDate}
      onScaleChange={setTimelineScale}
    />,
  );

  useEffect(() => {
    const seed = window.setTimeout(() => setNowMs(Date.now()), 0);
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearTimeout(seed);
      window.clearInterval(tick);
    };
  }, []);

  const view = useMemo(() => {
    if (nowMs === null) return null;
    return buildTimelineView(state.timeline, new Date(nowMs), {
      scale: timelineScale,
      customStart: parseCustomRangeBoundary(customStartIso, "start"),
      customEnd: parseCustomRangeBoundary(customEndIso, "end"),
    });
  }, [state.timeline, nowMs, timelineScale, customStartIso, customEndIso]);

  const summary = useMemo(() => {
    const blocks = view?.blocks ?? [];
    const work = blocks.filter((b) => b.type === "work");
    const brk = blocks.filter((b) => b.type === "break");
    const fixed = blocks.filter((b) => b.type === "fixed");
    return {
      work: work.length,
      breaks: brk.length,
      fixed: fixed.length,
      workMin: work.reduce((s, b) => s + (b.endAt.getTime() - b.startAt.getTime()) / 60000, 0),
    };
  }, [view]);

  const isInitialLoading = loading && !view;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="font-mono text-ink-3">views · timeline</span>}
        title="Timeline"
        description="A linear view of what the engine has planned, what's running, and what's already done. Resize by horizon — day, week, month, or a custom range."
        meta={
          <>
            <Pill variant="accent">
              <ListChecks className="h-3 w-3" />
              {view?.blocks.length ?? 0} blocks
            </Pill>
            <Pill variant="default">
              <Timer className="h-3 w-3" />
              {Math.round(summary.workMin)}m work
            </Pill>
            <Pill variant="default">
              <Coffee className="h-3 w-3" />
              {summary.breaks} breaks
            </Pill>
          </>
        }
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface-1 p-0.5">
            {(["day", "week", "month", "custom"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTimelineScale(s)}
                className={cn(
                  "h-7 rounded px-2 text-xs font-medium transition-colors",
                  timelineScale === s ? "bg-surface-3 text-ink-1" : "text-ink-3 hover:text-ink-1",
                )}
                aria-pressed={timelineScale === s}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      {timelineScale === "custom" ? (
        <Card>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-3">Range</span>
            <input
              type="date"
              value={customStartIso ? customStartIso.slice(0, 10) : ""}
              onChange={(e) => setCustomRange(e.target.value || null, customEndIso)}
              className="themed-datetime-input h-8 rounded-md border border-border bg-surface-1 px-2 text-ink-1"
            />
            <span className="text-ink-4">→</span>
            <input
              type="date"
              value={customEndIso ? customEndIso.slice(0, 10) : ""}
              onChange={(e) => setCustomRange(customStartIso, e.target.value || null)}
              className="themed-datetime-input h-8 rounded-md border border-border bg-surface-1 px-2 text-ink-1"
            />
          </div>
        </Card>
      ) : null}

      <Card padded={false}>
        {isInitialLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading timeline…
          </div>
        ) : !view || view.blocks.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-4">
            <Calendar className="mx-auto mb-2 h-6 w-6" />
            No blocks in this range. Create a tile to seed the timeline.
          </div>
        ) : (
          <div className="relative">
            {loading ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b border-border bg-surface-0/85 px-4 py-2 text-xs text-ink-3 backdrop-blur-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Refreshing timeline…
              </div>
            ) : null}
            <ol className="divide-y divide-border">
              {view.blocks.map((b) => (
                <li
                  key={b.id}
                  className="grid grid-cols-[60px_1fr_auto] items-center gap-3 px-4 py-2.5"
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-fit items-center rounded px-1.5 font-mono text-[10px] font-bold",
                      b.type === "work"
                        ? "bg-accent-soft text-accent"
                        : b.type === "break"
                          ? "bg-status-warn-soft text-status-warn"
                          : "bg-status-active-soft text-status-active",
                    )}
                  >
                    {b.type}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink-1">{b.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-3">
                      <span>{b.startLabel}</span>
                      <span className="text-ink-4">→</span>
                      <span>{b.endLabel}</span>
                      <span className="text-ink-4">·</span>
                      <span>{b.durationLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot
                      status={
                        b.status === "active" ? "active" : b.status === "done" ? "done" : "pending"
                      }
                      size="xs"
                    />
                    <ChevronRight className="h-3.5 w-3.5 text-ink-4" />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}

// TODO(new-shell): wire to new component
function useDashboardWorkspaceStorePlaceholder() {
  const [timelineScale, setTimelineScale] = useState<"day" | "week" | "month" | "custom">("day");
  const [customStartIso, setCustomStartIso] = useState<string | null>(null);
  const [customEndIso, setCustomEndIso] = useState<string | null>(null);
  function setCustomRange(start: string | null, end: string | null) {
    setCustomStartIso(start);
    setCustomEndIso(end);
  }
  return {
    timelineScale,
    customStartIso,
    customEndIso,
    setTimelineScale,
    setCustomRange,
  };
}
