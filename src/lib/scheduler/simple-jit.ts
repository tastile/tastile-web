import type { AppState } from "../core/state";
import { getTileLifecycle, type Tile } from "../domain/tile";

export interface NextTileSuggestion {
  tile: Tile;
  reason: string;
}

export function selectNextTile(state: AppState): NextTileSuggestion | null {
  const active = state.execution.activeTileId;

  const candidates = Array.from(state.tiles.values()).filter((tile) => {
    const lifecycle = getTileLifecycle(tile);
    return lifecycle !== "done" && tile.core.id !== active;
  });

  if (candidates.length === 0) return null;

  const withAction = candidates.filter((tile) => !!tile.core.nextAction?.trim());
  const pool = withAction.length > 0 ? withAction : candidates;

  pool.sort((a, b) => {
    const aTime = a.core.startedAt ? a.core.startedAt.getTime() : 0;
    const bTime = b.core.startedAt ? b.core.startedAt.getTime() : 0;
    return bTime - aTime;
  });

  const picked = pool[0];
  return {
    tile: picked,
    reason: picked.core.nextAction
      ? "次の具体アクションが定義されているため"
      : "未完了タイルの中で次に着手しやすいため",
  };
}
