"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import type { TileId } from "@/shared/model/ids";
import type { Locale } from "@/shared/stores/locale-store";
import { type Tile, getTileLifecycle } from "@/tile/model/types";
import { TileStatusIcon } from "@/tile/ui/TileStatusIcon";
import { TimelineAxis } from "./TimelineAxis";

interface RightSidebarProps {
  onClose?: () => void;
  nextTile: Tile | null;
  nextQuickTiles?: Tile[];
  nextReason?: string;
  onPromptSuggested?: (tileId: TileId) => void;
  timelineItems: Array<{
    id: string;
    time: string;
    date: string;
    type: "work" | "break" | "fixed";
    title: string;
    status: "done" | "active" | "scheduled";
    topPx?: number;
    heightPx?: number;
    lane?: number;
    totalLanes?: number;
    startAt?: Date;
    endAt?: Date;
  }>;
  timelineCanvasHeightPx?: number;
  timelineNowTopPx?: number | null;
  timelineMarkers?: Array<{ label: string; topPx: number }>;
  timelineMaxVisibleBlocks?: number;
  timelineMaxCanvasHeightPx?: number;
  timelineWindowStart?: Date | null;
  timelineWindowEnd?: Date | null;
}

export function RightSidebar({
  nextTile,
  nextQuickTiles = [],
  nextReason: _nextReason,
  onPromptSuggested,
  timelineItems,
  timelineCanvasHeightPx = 0,
  timelineNowTopPx = null,
  timelineMarkers = [],
  timelineMaxVisibleBlocks = 18,
  timelineMaxCanvasHeightPx = 640,
  timelineWindowStart = null,
  timelineWindowEnd = null,
}: RightSidebarProps) {
  const { t, locale } = useTranslation();
  void _nextReason;
  const fallback = new Date(0);
  const timelineRangeLabel = formatTimelineRangeLabel(
    timelineWindowStart,
    timelineWindowEnd,
    locale,
  );

  return (
    <aside className="relative flex w-72 min-w-0 flex-col gap-3 bg-transparent">
      {/* Next Up Card */}
      <div className="rounded-xl bg-surface-1 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          {t("sidebar.nextUp")}
        </h3>
        {nextTile ? (
          <div className="space-y-2">
            <div className="rounded-md bg-surface-1 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <TileStatusIcon
                  lifecycle={getTileLifecycle(nextTile)}
                  onClick={() => onPromptSuggested?.(nextTile.core.id)}
                  size={16}
                />
                <div className="min-w-0 max-w-full truncate text-sm font-semibold text-foreground">
                  {nextTile.core.title}
                </div>
              </div>
            </div>
            {nextQuickTiles.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto">
                {nextQuickTiles.map((tile) => (
                  <div
                    key={tile.core.id}
                    className="min-w-[128px] max-w-[168px] rounded-md bg-surface-1 px-2 py-1 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      <TileStatusIcon
                        lifecycle={getTileLifecycle(tile)}
                        onClick={() => onPromptSuggested?.(tile.core.id)}
                        size={12}
                      />
                      <div className="min-w-0 max-w-full truncate text-xs font-semibold text-foreground">
                        {tile.core.title}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">{t("tiles.noTiles")}</p>
        )}
      </div>

      {/* Timeline Card */}
      <div className="flex-1 overflow-hidden rounded-xl bg-surface-1 p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            {t("sidebar.timeline")}
          </h3>
          {timelineRangeLabel ? (
            <span
              className="text-caption font-medium text-foreground-muted"
              title={timelineRangeLabel}
            >
              {timelineRangeLabel}
            </span>
          ) : null}
        </div>
        <TimelineAxis
          compact
          blocks={timelineItems.map((item) => ({
            id: item.id,
            title: item.title,
            type: item.type,
            status: item.status,
            topPx: item.topPx ?? 0,
            heightPx: item.heightPx ?? 24,
            lane: item.lane ?? 0,
            totalLanes: item.totalLanes ?? 1,
            startLabel: item.time,
            endLabel: item.time,
            durationLabel: "",
            dateLabel: item.date,
            timeLabel: item.time,
            startAt: item.startAt ?? fallback,
            endAt: item.endAt ?? fallback,
          }))}
          markers={timelineMarkers}
          canvasHeightPx={timelineCanvasHeightPx}
          nowTopPx={timelineNowTopPx}
          maxVisibleBlocks={timelineMaxVisibleBlocks}
          maxCanvasHeightPx={timelineMaxCanvasHeightPx}
        />
      </div>
    </aside>
  );
}

const timelineRangeFormatters: Record<Locale, Intl.DateTimeFormat> = {
  ja: new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }),
  en: new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }),
  es: new Intl.DateTimeFormat("es-ES", { month: "numeric", day: "numeric" }),
  ko: new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }),
  "zh-CN": new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }),
};

function formatTimelineRangeLabel(
  start: Date | null,
  end: Date | null,
  locale: Locale,
): string | null {
  if (!start || !end) return null;
  // Day-scale windows are [00:00, 24:00) — treat as a single day for display.
  const isNextDayMidnight =
    (end.getHours() === 0 &&
      end.getMinutes() === 0 &&
      end.getSeconds() === 0 &&
      end.getDate() === start.getDate() + 1 &&
      end.getMonth() === start.getMonth()) ||
    (end.getDate() === 1 &&
      start.getDate() === new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate());
  const displayEnd = isNextDayMidnight ? new Date(end.getTime() - 1) : end;
  const fmt = timelineRangeFormatters[locale];
  const startLabel = fmt.format(start);
  const endLabel = fmt.format(displayEnd);
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}
