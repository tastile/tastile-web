"use client";
import { useEffect, useMemo, useRef, useState } from "react";

interface TimelineItem {
  id: string;
  time: string;
  title: string;
  type: "work" | "break" | "fixed";
  status: "done" | "active" | "scheduled";
  date?: string;
}

interface TimelineBlock {
  id: string;
  title: string;
  type: "work" | "break" | "fixed";
  status: "done" | "active" | "scheduled";
  topPx: number;
  heightPx: number;
  lane: number;
  totalLanes: number;
  startLabel: string;
  endLabel: string;
  durationLabel: string;
  dateLabel: string;
  timeLabel: string;
  startAt: Date;
  endAt: Date;
}

interface TimelineAxisProps {
  items?: TimelineItem[]; // legacy
  blocks: TimelineBlock[];
  markers?: Array<{ label: string; topPx: number }>;
  canvasHeightPx?: number;
  nowTopPx?: number | null;
  compact?: boolean;
  maxVisibleBlocks?: number;
  maxCanvasHeightPx?: number;
}

export function TimelineAxis({
  items,
  blocks,
  markers = [],
  canvasHeightPx = 0,
  nowTopPx = null,
  compact = false,
  maxVisibleBlocks,
  maxCanvasHeightPx,
}: TimelineAxisProps) {
  const legacyItems = items ?? [];
  const [zoom, setZoom] = useState(1);
  const [scope, setScope] = useState<"day" | "around-now">("day");
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      setZoom((prev) => {
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        return Math.max(0.5, Math.min(3, prev + delta));
      });
    };
    surface.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      surface.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const effective = useMemo(() => {
    const source = blocks.length > 0 ? blocks : [];
    if (scope === "day") return source;
    const now = new Date();
    const start = now.getTime() - 12 * 60 * 60 * 1000;
    const end = now.getTime() + 12 * 60 * 60 * 1000;
    return source.filter(
      (block) => block.endAt.getTime() >= start && block.startAt.getTime() <= end,
    );
  }, [blocks, scope]);

  const limit = maxVisibleBlocks ?? (compact ? 18 : 60);
  const visible = useMemo(() => {
    if (effective.length <= limit) return effective;
    const sorted = [...effective].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    let focusIndex = sorted.findIndex((block) => block.status === "active");
    if (focusIndex < 0) focusIndex = Math.floor(sorted.length / 2);
    if (focusIndex < 0) focusIndex = sorted.length - 1;
    const lead = Math.floor(limit * 0.3);
    const start = Math.max(0, Math.min(sorted.length - limit, focusIndex - lead));
    return sorted.slice(start, start + limit);
  }, [effective, limit]);

  if (visible.length === 0 && legacyItems.length === 0) {
    return <p className="text-sm text-foreground-muted">No upcoming timeline items</p>;
  }

  if (visible.length > 0) {
    const minTop = Math.min(...visible.map((block) => block.topPx));
    const maxBottom = Math.max(...visible.map((block) => block.topPx + block.heightPx));
    const maxBlockHeightPx = Math.max(...visible.map((block) => Math.max(16, block.heightPx)));
    const computedMaxHeight = maxCanvasHeightPx ?? (compact ? 640 : 960);
    const viewportHeight = Math.min(Math.max(320, canvasHeightPx), computedMaxHeight);
    const scaledHeight = Math.max(320, (maxBottom - minTop) * zoom + maxBlockHeightPx + 48);
    const viewportMin = minTop - 24;
    const viewportMax = maxBottom + 24;
    const visibleMarkers = markers.filter(
      (marker) => marker.topPx >= viewportMin && marker.topPx <= viewportMax,
    );
    const omitted = Math.max(0, effective.length - visible.length);

    return (
      <div
        ref={surfaceRef}
        data-testid="timeline-surface"
        className="relative w-full min-w-0 overflow-x-hidden overflow-y-auto rounded-lg bg-surface-1 p-2"
        style={{ maxHeight: viewportHeight }}
      >
        {!compact ? (
          <div className="mb-2 flex items-center gap-2">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "day" | "around-now")}
              className="rounded-md bg-surface-0 px-2 py-1 text-xs text-foreground"
            >
              <option value="day">24h</option>
              <option value="around-now">Now ±12h</option>
            </select>
            <input
              aria-label="timeline-zoom"
              type="range"
              min={0.5}
              max={3}
              step={0.25}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>
        ) : null}
        {omitted > 0 ? (
          <p className="mb-2 text-[10px] uppercase tracking-wider text-foreground-muted">
            +{omitted} omitted
          </p>
        ) : null}
        <div className="relative min-h-[320px]" style={{ height: scaledHeight }}>
          {nowTopPx !== null ? (
            <div
              data-testid="timeline-now"
              className="absolute left-0 right-0 z-20"
              style={{ top: (nowTopPx - minTop + 24) * zoom }}
            />
          ) : null}
          {visibleMarkers.map((marker) => (
            <div
              key={`marker-${marker.label}-${marker.topPx}`}
              className="absolute left-0 right-0 z-0"
              style={{ top: (marker.topPx - minTop + 24) * zoom }}
            >
              <span className="absolute -top-2 left-1 text-[10px] font-mono text-foreground-muted/80">
                {marker.label}
              </span>
            </div>
          ))}
          {visible.map((block) => {
            const widthPct = 100 / Math.max(1, block.totalLanes);
            const leftPct = block.lane * widthPct;
            return (
              <div
                key={block.id}
                className="absolute rounded-md bg-primary/10 px-2 py-1"
                style={{
                  top: (block.topPx - minTop + 24) * zoom,
                  height: Math.max(16, block.heightPx * zoom),
                  left: `calc(${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                }}
              >
                <p className="truncate text-xs font-semibold text-foreground">{block.title}</p>
                <p className="text-[10px] uppercase tracking-wider text-foreground-muted">
                  {block.type}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {legacyItems.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <div
            data-testid="timeline-time"
            className="w-24 shrink-0 text-xs font-mono text-foreground-muted"
          >
            {item.date ? `${item.date} ${item.time}` : item.time}
          </div>
          <div className="relative pt-0.5">
            <span
              className={
                item.status === "active"
                  ? "block h-2.5 w-2.5 rounded-full bg-primary"
                  : item.status === "done"
                    ? "block h-2.5 w-2.5 rounded-full bg-success"
                    : "block h-2.5 w-2.5 rounded-full bg-foreground-subtle"
              }
            />
            <span className="absolute left-[5px] top-3 h-7 w-px bg-foreground/15" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-foreground truncate">{item.title}</p>
            <p className="text-[11px] uppercase tracking-wider text-foreground-muted">
              {item.type}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
