// src/lib/core/reducer/tile-reducer.ts
import { Tile, TileLifecycle } from '../../domain/tile'
import { TileStartedPayload, TileDeferredPayload, TileCompletedPayload, MemoAttachedPayload } from '../event'

export function applyTileStarted(tile: Tile, _payload: TileStartedPayload): void {
  tile.core.lifecycle = TileLifecycle.Started
}

export function applyTileDeferred(tile: Tile, _payload: TileDeferredPayload): void {
  tile.core.lifecycle = TileLifecycle.Deferred
}

export function applyTileCompleted(tile: Tile, _payload: TileCompletedPayload): void {
  tile.core.lifecycle = TileLifecycle.Done
}

export function applyMemoAttached(_tile: Tile, _payload: MemoAttachedPayload): void {
  // Memos are tracked separately in practice; this is a placeholder
}
