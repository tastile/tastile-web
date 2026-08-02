"use client";

import { TILE_CARD_STYLES } from "@/lib/styles/tile-card-styles";
import { cn } from "@/shared/lib/cn";
import { Skeleton } from "@mantine/core";

interface LoadingCardProps {
  variant?: "compact" | "comfortable" | "detailed";
}

export function LoadingCard({ variant = "comfortable" }: LoadingCardProps) {
  const isCompact = variant === "compact";
  const isDetailed = variant === "detailed";

  return (
    <div
      className={cn(
        TILE_CARD_STYLES.base,
        isCompact && TILE_CARD_STYLES.padding.compact,
        !isCompact && !isDetailed && TILE_CARD_STYLES.padding.comfortable,
        isDetailed && TILE_CARD_STYLES.padding.detailed,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          {!isCompact && <Skeleton className="h-3 w-1/2" />}
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}
