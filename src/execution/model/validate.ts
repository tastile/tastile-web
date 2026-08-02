// ============================================================================
// Domain Layer: Validation
// ============================================================================
//
// 検証ロジックは Domain Layer に配置される。
// UI → API Layer → Domain Layer (validate) → Infrastructure
// ============================================================================

import { getTileLifecycle } from "@/tile/model/tile";
import type { Command } from "./command";
import type { AppState } from "./state";

/**
 * 検証エラー
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * 検証ルール
 */
export const validate = (command: Command, state: AppState): void => {
  switch (command.type) {
    case "create_tile": {
      // タイトルが空でないこと
      if (!command.tile.core.title.trim()) {
        throw new ValidationError("Title cannot be empty");
      }

      // tile_id と tile の ID が一致すること
      if (command.tile.core.id !== command.tile_id) {
        throw new ValidationError("tile_id must match tile.core.id");
      }

      return;
    }

    case "start_tile": {
      const tile = state.tiles.get(command.tile_id);
      if (!tile) {
        throw new ValidationError(`Tile not found: ${command.tile_id}`);
      }

      // 完了したタイルは開始できない
      if (getTileLifecycle(tile) === "done") {
        throw new ValidationError("Cannot start completed tile");
      }

      // 既に開始されているタイル
      if (tile.work.segments.some((seg) => !seg.endAt)) {
        throw new ValidationError("Tile already started");
      }

      return;
    }

    case "complete_tile": {
      const tile = state.tiles.get(command.tile_id);
      if (!tile) {
        throw new ValidationError(`Tile not found: ${command.tile_id}`);
      }

      // アクティブタイルのみ完了可能
      if (state.execution.activeTileId !== command.tile_id) {
        throw new ValidationError("Can only complete active tile");
      }

      return;
    }

    case "defer_tile": {
      const tile = state.tiles.get(command.tile_id);
      if (!tile) {
        throw new ValidationError(`Tile not found: ${command.tile_id}`);
      }

      return;
    }

    case "delete_tile": {
      const tile = state.tiles.get(command.tile_id);
      if (!tile) {
        throw new ValidationError(`Tile not found: ${command.tile_id}`);
      }

      return;
    }

    case "start_break": {
      // 中断が進行中ではないこと
      const hasBreakInProgress = Array.from(state.tiles.values()).some(
        (tile) =>
          tile.annotation.semanticRole === "break" &&
          tile.core.startedAt !== null &&
          tile.core.completedAt === null,
      );
      if (hasBreakInProgress) {
        throw new ValidationError("Break already in progress");
      }

      return;
    }

    case "switch_active_tile": {
      // 自分自身への切り替えは不可能
      if (command.from_tile_id === command.to_tile_id) {
        throw new ValidationError("Cannot switch to same tile");
      }

      const fromTile = state.tiles.get(command.from_tile_id);
      if (!fromTile) {
        throw new ValidationError(`Tile not found: ${command.from_tile_id}`);
      }

      const toTile = state.tiles.get(command.to_tile_id);
      if (!toTile) {
        throw new ValidationError(`Tile not found: ${command.to_tile_id}`);
      }

      return;
    }

    case "end_break": {
      if (command.tile_id) {
        const tile = state.tiles.get(command.tile_id);
        if (!tile) {
          throw new ValidationError(`Tile not found: ${command.tile_id}`);
        }
        if (
          tile.annotation.semanticRole !== "break" ||
          tile.core.startedAt === null ||
          tile.core.completedAt !== null
        ) {
          throw new ValidationError("Break not in progress");
        }
      }

      return;
    }

    case "extend_phase": {
      if (command.delta_min <= 0) {
        throw new ValidationError("Extend delta must be > 0");
      }

      const tile = state.tiles.get(command.tile_id);
      if (!tile) {
        throw new ValidationError(`Tile not found: ${command.tile_id}`);
      }

      // 進行中のタイルのみ拡張可能
      if (tile.core.startedAt === null || tile.core.completedAt !== null) {
        throw new ValidationError("Tile not in progress");
      }

      return;
    }

    case "clear_prompt": {
      return;
    }

    case "request_prompt": {
      return;
    }

    default:
      // 未実装のコマンド
      throw new ValidationError(`Unhandled command type: ${command.type}`);
  }
};
