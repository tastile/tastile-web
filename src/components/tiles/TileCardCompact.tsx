"use client";

import type { TileId } from "@/lib/domain/ids";
import { type Tile, getTileLifecycle } from "@/lib/domain/tile";
import type { TileListView } from "@/lib/hooks/use-tile-list";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Locale } from "@/lib/stores/locale-store";
import { cn } from "@/lib/utils/cn";
import { formatDuration, formatFriendlyDateTime } from "@/lib/utils/tile-formatters";
import { ActionIcon, Button } from "@mantine/core";
import { SquarePen } from "lucide-react";
import { LoadingCard } from "./shared/LoadingCard";
import { TileStatusIcon } from "./shared/TileStatusIcon";

interface TileCardCompactProps {
  tile: Tile | null;
  /**
   * Optional raw `TileListView` — when present and `view.source` is
   * non-null, a SourceTile summary chip is rendered alongside the
   * label/project badges. The chip reads `view.source.kind` only inside
   * the render branch; the `Tile` domain type has no slot for source
   * metadata, so this prop is passed sibling-style rather than through
   * the mapper (v1/10 §9 — no break/sleep discriminator on Tile).
   */
  listView?: TileListView | null;
  loading?: boolean;
  onStart?: (tileId: TileId) => void;
  onClick?: (tile: Tile) => void;
  onEdit?: (tileId: TileId) => void;
}

export function TileCardCompact({
  tile,
  listView,
  loading,
  onStart,
  onClick,
  onEdit,
}: TileCardCompactProps) {
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

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick();
    }
  };

  const interactive = Boolean(onClick);

  const cardClassName = cn(
    "flex items-center gap-4 py-2 px-3 border-b border-border/40 hover:bg-surface-2 transition-colors",
    onClick && "cursor-pointer",
  );

  const cardContent = (
    <>
      {/* Status */}
      <TileStatusIcon
        lifecycle={lifecycle}
        onClick={onStart ? handleStatusClick : undefined}
        size={18}
      />

      {/* Title and badges */}
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <h4
          className={cn(
            "text-sm font-medium text-foreground truncate max-w-[240px] md:max-w-[400px]",
            lifecycle === "done" && "line-through opacity-60",
          )}
        >
          {tile.core.title}
        </h4>

        {/* Label and project badges */}
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

          {/* SourceTile summary chip. Rendered only when `listView.source`
              is non-null — never derives a "is this a Source?" discriminator
              elsewhere (v1/10 §9). The `kind` field is numeric-typed; we
              branch on 0/1/null for display text only. */}
          {listView?.source
            ? (() => {
                const sourceKind = listView.source?.kind ?? null;
                const chipLabel =
                  sourceKind === 0
                    ? t("tiles.source.break")
                    : sourceKind === 1
                      ? t("tiles.source.sleep")
                      : t("tiles.source.legacy");
                return (
                  <span
                    className="px-1.5 py-0.2 text-[9px] rounded font-medium tracking-wide border whitespace-nowrap bg-surface-3/50 text-foreground-subtle border-border"
                    data-source-kind={sourceKind ?? "legacy"}
                  >
                    {chipLabel}
                  </span>
                );
              })()
            : null}
        </div>
      </div>

      {/* Time-related metadata column */}
      <div className="flex items-center gap-4 shrink-0 text-xs text-foreground-subtle select-none">
        {/* Required duration */}
        {tile.objective.targetWorkMin || tile.objective.targetRestMin ? (
          <div className="font-mono text-right min-w-[48px] bg-surface-3/50 border border-border px-1.5 py-0.5 rounded text-[10px] text-foreground-subtle">
            {durationText}
          </div>
        ) : null}

        {/* Start / due datetime */}
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

      {/* Actions */}
      {onEdit ? (
        <ActionIcon
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(tile.core.id);
          }}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-2 text-foreground-muted hover:bg-surface-3 hover:text-foreground"
          aria-label="Edit tile"
          title="Edit tile"
          variant="subtle"
          size="sm"
        >
          <SquarePen className="h-3.5 w-3.5" />
        </ActionIcon>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <Button
        type="button"
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className={cardClassName}
      >
        {cardContent}
      </Button>
    );
  }

  return <div className={cardClassName}>{cardContent}</div>;
}

function resolveDurationText(tile: Tile, locale: Locale): string {
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
