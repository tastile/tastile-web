"use client";

import { ActionIcon } from "@mantine/core";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { TileLifecycle } from "@/lib/domain/tile";
import { TILE_STATUS_COLORS } from "@/lib/styles/tile-card-styles";
import { cn } from "@/lib/utils/cn";

interface TileStatusIconProps {
  lifecycle: TileLifecycle;
  onClick?: () => void;
  disabled?: boolean;
  size?: number;
  className?: string;
}

export function TileStatusIcon({
  lifecycle,
  onClick,
  disabled = false,
  size = 20,
  className,
}: TileStatusIconProps) {
  const IconComponent =
    lifecycle === "ready" ? Circle : lifecycle === "started" ? CircleDot : CheckCircle2;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <ActionIcon
      type="button"
      onClick={handleClick}
      disabled={disabled || !onClick}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-all relative",
        !disabled &&
          onClick &&
          "hover:ring-2 hover:ring-foreground/20 hover:ring-offset-2 hover:ring-offset-background cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        TILE_STATUS_COLORS[lifecycle],
        className,
      )}
      aria-label={`Status: ${lifecycle}`}
      variant="subtle"
      size="sm"
    >
      {lifecycle === "started" && (
        <div className="absolute inset-0 rounded-full bg-current animate-ping opacity-75" />
      )}
      <IconComponent size={size} className="relative z-10" />
    </ActionIcon>
  );
}
