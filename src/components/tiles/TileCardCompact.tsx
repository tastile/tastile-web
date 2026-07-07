"use client";

import { SquarePen } from "lucide-react";
import type { TileId } from "@/lib/domain/ids";
import { getTileLifecycle, type Tile } from "@/lib/domain/tile";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import { formatDuration, formatFriendlyDateTime } from "@/lib/utils/tile-formatters";
import { LoadingCard } from "./shared/LoadingCard";
import { TileStatusIcon } from "./shared/TileStatusIcon";

interface TileCardCompactProps {
  tile: Tile | null;
  loading?: boolean;
  onStart?: (tileId: TileId) => void;
  onClick?: (tile: Tile) => void;
  onEdit?: (tileId: TileId) => void;
}

export function TileCardCompact({ tile, loading, onStart, onClick, onEdit }: TileCardCompactProps) {
  const { t, locale } = useTranslation();

  if (loading) {
    return <LoadingCard variant="compact" />;
  }

  if (!tile) {
    return null;
  }

  const lifecycle = getTileLifecycle(tile);
  const startAt =
    tile.core.startedAt ??
    tile.temporal.fixedStart ??
    tile.temporal.activeStart ??
    tile.temporal.releaseAt ??
    tile.work.segments.find((segment) => segment.startAt)?.startAt ??
    null;
  // Only render "unscheduled" when the lifecycle explicitly says the tile
  // is READY and there is no temporal anchor.  When lifecycle is STARTED,
  // DONE, or CLOSED, the absence of a temporal anchor is a data error, not
  // an "unscheduled" state.
  const showUnscheduledBadge = lifecycle === "ready" && startAt === null;
  const durationText = resolveDurationText(tile, locale);
  const startText = startAt ? formatFriendlyDateTime(startAt, locale, tile.temporal.tz) : "";

  const handleStatusClick = () => {
    if (onStart) {
      onStart(tile.core.id);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(tile);
    }
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick();
    }
  };

  const interactive = Boolean(onClick);
  const interactiveProps = interactive ? ({ role: "button", tabIndex: 0 } as const) : ({} as const);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: card acts as button only when onClick is provided (role + tabIndex added)
    <div
      {...interactiveProps}
      onClick={handleCardClick}
      onKeyDown={interactive ? handleCardKeyDown : undefined}
      className={cn(
        "flex items-center gap-4 py-2 px-3 border-b border-border/40 hover:bg-surface-2 transition-colors",
        onClick && "cursor-pointer",
      )}
    >
      {/* ステータス */}
      <TileStatusIcon
        lifecycle={lifecycle}
        onClick={onStart ? handleStatusClick : undefined}
        size={18}
      />

      {/* タイトルとバッジ */}
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <h4
          className={cn(
            "text-sm font-medium text-foreground truncate max-w-[240px] md:max-w-[400px]",
            lifecycle === "done" && "line-through opacity-60",
          )}
        >
          {tile.core.title}
        </h4>

        {/* ラベル・プロジェクトバッジ */}
        <div className="flex flex-wrap gap-1 shrink-0">
          {tile.annotation.labels.map((label) => {
            const isProject = label.startsWith("project:");
            const labelText = isProject ? label.substring(8) : `#${label}`;
            return (
              <span
                key={label}
                className={cn(
                  "px-1.5 py-0.2 text-[9px] rounded font-medium tracking-wide border whitespace-nowrap",
                  isProject
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-surface-3/50 text-foreground-subtle border-border",
                )}
              >
                {labelText}
              </span>
            );
          })}
        </div>
      </div>

      {/* 時間関連のメタデータ列 */}
      <div className="flex items-center gap-4 shrink-0 text-xs text-foreground-subtle select-none">
        {/* 所要時間 */}
        {tile.objective.targetWorkMin || tile.objective.targetRestMin ? (
          <div className="font-mono text-right min-w-[48px] bg-surface-3/50 border border-border px-1.5 py-0.5 rounded text-[10px] text-foreground-subtle">
            {durationText}
          </div>
        ) : null}

        {/* 開始/期限日時 */}
        {showUnscheduledBadge ? (
          <div className="text-right min-w-[90px] text-[11px] text-foreground-lighter italic">
            {t("tiles.unscheduled")}
          </div>
        ) : startAt ? (
          <div className="text-right min-w-[90px] whitespace-nowrap text-[11px] text-foreground-subtle">
            {startText}
          </div>
        ) : null}
      </div>

      {/* アクション */}
      {onEdit ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(tile.core.id);
          }}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-2 text-foreground-muted hover:bg-surface-3 hover:text-foreground"
          aria-label="Edit tile"
          title="Edit tile"
        >
          <SquarePen className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function resolveDurationText(tile: Tile, locale: "ja" | "en"): string {
  if (typeof tile.objective.targetWorkMin === "number" && tile.objective.targetWorkMin > 0) {
    return formatDuration(tile.objective.targetWorkMin, locale);
  }
  if (typeof tile.objective.targetRestMin === "number" && tile.objective.targetRestMin > 0) {
    return formatDuration(tile.objective.targetRestMin, locale);
  }
  const totalWorked = tile.work.segments.reduce((sum, segment) => {
    if (!segment.endAt) return sum;
    const diff = Math.max(
      0,
      Math.round((segment.endAt.getTime() - segment.startAt.getTime()) / 60000),
    );
    return sum + diff;
  }, 0);
  if (totalWorked > 0) return formatDuration(totalWorked, locale);
  return formatDuration(null, locale);
}
