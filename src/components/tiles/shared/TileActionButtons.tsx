"use client";

import type { TileId } from "@/lib/domain/ids";
import { getTileLifecycle, type Tile } from "@/lib/domain/tile";
import { useTranslation } from "@/lib/i18n/use-translation";
import { BUTTON_STYLES } from "@/lib/styles/button-styles";
import { cn } from "@/lib/utils/cn";

interface TileActionButtonsProps {
  tile: Tile;
  variant: "compact" | "full";
  onStart?: (tileId: TileId) => void;
  onComplete?: (tileId: TileId) => void;
  onDefer?: (tileId: TileId) => void;
  onInterrupt?: (tileId: TileId) => void;
  onEdit?: (tileId: TileId) => void;
  onDelete?: (tileId: TileId) => void;
}

type ActionButtonProps = {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
};

function ActionButton({ onClick, children, primary = false }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold",
        primary ? BUTTON_STYLES.primary : BUTTON_STYLES.secondary,
      )}
    >
      {children}
    </button>
  );
}

export function TileActionButtons({ tile, variant, ...actions }: TileActionButtonsProps) {
  const { t } = useTranslation();
  const lifecycle = getTileLifecycle(tile);

  if (lifecycle === "ready") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {actions.onStart && (
          <ActionButton onClick={() => actions.onStart?.(tile.core.id)} primary>
            {t("tiles.actions.start")}
          </ActionButton>
        )}
        {variant === "full" && (
          <>
            {actions.onDefer && (
              <ActionButton onClick={() => actions.onDefer?.(tile.core.id)}>
                {t("tiles.actions.defer")}
              </ActionButton>
            )}
            {actions.onEdit && (
              <ActionButton onClick={() => actions.onEdit?.(tile.core.id)}>
                {t("tiles.actions.edit")}
              </ActionButton>
            )}
            {actions.onDelete && (
              <ActionButton onClick={() => actions.onDelete?.(tile.core.id)}>
                {t("tiles.actions.delete")}
              </ActionButton>
            )}
          </>
        )}
      </div>
    );
  }

  if (lifecycle === "started") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {actions.onComplete && (
          <ActionButton onClick={() => actions.onComplete?.(tile.core.id)} primary>
            {t("tiles.actions.complete")}
          </ActionButton>
        )}
        {variant === "full" && (
          <>
            {actions.onInterrupt && (
              <ActionButton onClick={() => actions.onInterrupt?.(tile.core.id)}>
                {t("tiles.actions.interrupt")}
              </ActionButton>
            )}
            {actions.onEdit && (
              <ActionButton onClick={() => actions.onEdit?.(tile.core.id)}>
                {t("tiles.actions.edit")}
              </ActionButton>
            )}
            {actions.onDelete && (
              <ActionButton onClick={() => actions.onDelete?.(tile.core.id)}>
                {t("tiles.actions.delete")}
              </ActionButton>
            )}
          </>
        )}
      </div>
    );
  }

  // done state
  if (variant === "full" && actions.onDelete) {
    return (
      <div className="flex items-center gap-2">
        <ActionButton onClick={() => actions.onDelete?.(tile.core.id)}>
          {t("tiles.actions.delete")}
        </ActionButton>
      </div>
    );
  }

  return null;
}
