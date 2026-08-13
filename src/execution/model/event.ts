import {
  type CommandId,
  EventId,
  type RequestId,
  type SegmentId,
  type TileId,
} from "@/shared/model/ids";
import type { Actor } from "@/tile/model/actor";
import type { SegmentMode, Tile } from "@/tile/model/types";

export type Event =
  | {
      type: "tile_created";
      tile: Tile;
    }
  | {
      type: "tile_started";
      tile_id: TileId;
      started_at: Date;
    }
  | {
      type: "tile_completed";
      tile_id: TileId;
      completed_at: Date;
    }
  | {
      type: "tile_closed";
      tile_id: TileId;
      reason: string | null;
      closed_at: Date;
    }
  | {
      type: "tile_deferred";
      tile_id: TileId;
      deferred_at: Date;
      next_start_at: Date | null;
    }
  | {
      type: "tile_deleted";
      tile_id: TileId;
      deleted_at: Date;
    }
  | {
      type: "active_tile_switched";
      from_tile_id: TileId;
      to_tile_id: TileId;
      switched_at: Date;
    }
  | {
      type: "set_focused_tile";
      tile_id: TileId | null;
      changed_at: Date;
    }
  | {
      type: "phase_extended";
      tile_id: TileId;
      delta_min: number;
      extended_at: Date;
    }
  | {
      type: "segment_started";
      segment_id: SegmentId;
      tile_id: TileId;
      mode: SegmentMode;
      started_at: Date;
      expected_end_at?: Date | null;
    }
  | {
      type: "segment_ended";
      segment_id: SegmentId;
      tile_id: TileId;
      mode: SegmentMode;
      ended_at: Date;
    }
  | {
      type: "break_started";
      linked_tile_id: TileId | null;
      started_at: Date;
      ends_at: Date;
      reason: string | null;
    }
  | {
      type: "break_ended";
      ended_at: Date;
    }
  | {
      type: "tile_interrupted";
      tile_id: TileId;
      interrupted_at: Date;
      source: "fixed_schedule" | "user_switch" | "high_priority" | "system_force";
      reason: string | null;
      switched_to_tile_id: TileId | null;
    }
  | {
      type: "memo_attached";
      tile_id: TileId | null;
      text: string;
      memo_kind: string | null;
      attached_at: Date;
    }
  | {
      type: "prompt_scheduled";
      prompt_id: string;
      tile_id: TileId | null;
      scheduled_at: Date;
      reason: string;
      kind: "start_tile" | "end_tile" | "end_break";
      severity: "soft" | "elevated" | "critical";
      suggested_minutes: number | null;
      reasons: string[];
      actions: Array<
        | "start_tile"
        | "start_break_parallel"
        | "start_break_split"
        | "start_break_split_and_extend"
        | "complete_phase"
        | "complete_tile"
        | "extend_phase"
        | "defer_tile"
        | "end_break"
        | "confirm_continue"
        | "confirm_stop_at"
        | "confirm_executed"
        | "confirm_skipped"
        | "dismiss"
      >;
    }
  | {
      type: "prompt_cleared";
      prompt_id: string;
      cleared_at: Date;
      reason: string;
    }
  | {
      type: "display_priority_changed";
      tile_id: TileId;
      old_priority: number;
      new_priority: number;
      changed_at: Date;
    };

export interface EventEnvelope {
  event_id: EventId;
  aggregate_id: string;
  occurred_at: Date;
  actor: Actor;
  caused_by_command_id: CommandId | null;
  request_id: RequestId | null;
  event: Event;
}

export const EventEnvelope = {
  create(
    event: Event,
    aggregateId: string,
    actor: Actor,
    causedBy: CommandId | null = null,
  ): EventEnvelope {
    return {
      event_id: EventId.new(),
      aggregate_id: aggregateId,
      occurred_at: new Date(),
      actor,
      caused_by_command_id: causedBy,
      request_id: null,
      event,
    };
  },
};
