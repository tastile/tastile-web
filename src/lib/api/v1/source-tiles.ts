import { type ApiClient, getRead, type Result, sendCommand } from "./endpoints";
import { type ApiError, type CommandRequest, type CommandResponse, nowIso, uuidv7 } from "@/lib/domain/v1/envelope";

export interface UtcSpan {
  start: string;
  end: string;
}

/** JSON-only values accepted by Core's typed Plan/Flow definitions. */
export type SourceTileWireValue =
  | null
  | boolean
  | number
  | string
  | SourceTileWireValue[]
  | { [key: string]: SourceTileWireValue };

/** Server-owned SourceTile IDs are intentionally absent from this payload. */
export interface SourceTileDefinitionWire {
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  external_id: string | null;
}

/** Exact top-level `SchedulePlanDefinition` wire contract. */
export interface SourceTilePlanWire {
  role: number;
  references: SourceTileWireValue[];
  completion: SourceTileWireValue;
  planning: {
    placement_rules: SourceTileWireValue[];
    nesting_rules: SourceTileWireValue[];
  };
  metrics: SourceTileWireValue[];
  decisions: SourceTileWireValue[];
}

export interface SourceGenerationWire {
  /** Core's current `SourceGenerationKind` numeric registry value. */
  kind: number;
  at: string | null;
  starts_at: string | null;
  interval_ms: number | null;
  ends_at: string | null;
  weekday_mask: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  excluded_dates?: string[];
}

export interface SourceScheduleWire {
  required_duration_ms: number;
  generation: SourceGenerationWire;
  window: { start_offset_ms: number; end_offset_ms: number };
  split_policy: {
    kind: number;
    min_segment_ms: number | null;
    max_segment_ms: number | null;
    max_segments: number | null;
  };
  priority: number;
}

/** `POST /v1/source-tiles` payload. */
export interface SourceTileCreatePayload {
  tile: SourceTileDefinitionWire;
  plan: SourceTilePlanWire;
  flows: SourceTileWireValue[];
  schedule: SourceScheduleWire;
  horizon: UtcSpan;
}

/** `PUT /v1/source-tiles/{id}` body; the source ID belongs only in the path. */
export type SourceTileUpdatePayload = SourceTileCreatePayload;

export interface SourceScheduleRead {
  required_duration_ms: number;
  generation: { kind: number; at: string | null; starts_at: string | null; interval_ms: number | null; ends_at: string | null; weekday_mask: number | null; date_range_start: string | null; date_range_end: string | null; excluded_dates: string[] };
  window: { start_offset_ms: number; end_offset_ms: number };
  split_policy: { kind: number; min_segment_ms: number | null; max_segment_ms: number | null; max_segments: number | null };
  priority: number;
}

export interface SourceTileRead {
  source_tile_id: string;
  plan_id: string;
  owner_id: string;
  revision: number;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  external_id: string | null;
  plan_role: number;
  schedule: SourceScheduleRead;
  created_at: string;
  updated_at: string;
}

export interface OccurrenceRead {
  occurrence_id: string;
  source_tile_id: string;
  sequence_no: number;
  nominal_at: string;
  window_start: string;
  window_end: string;
  required_duration_ms: number;
  state: number;
  revision: number;
}

export interface PlacementRead {
  placement_id: string;
  source_tile_id: string;
  occurrence_id: string;
  split_index: number;
  split_count: number;
  split_group_id: string;
  start: string;
  end: string;
  closed: boolean;
  closed_at: string | null;
  revision: number;
}

export interface SourceTileDetail {
  source: SourceTileRead;
  occurrences: OccurrenceRead[];
  placements: PlacementRead[];
}

export type SourceTileCommandResult =
  | { ok: true; data: CommandResponse; status: number }
  | { ok: false; error: ApiError };

function commandEnvelope<T>(payload: T, expectedRevision: number | null): CommandRequest<T> {
  return { expectedRevision, idempotencyKey: uuidv7(), occurredAt: nowIso(), payload };
}

export function createSourceTile(options: {
  client: ApiClient;
  payload: SourceTileCreatePayload;
}): Promise<SourceTileCommandResult> {
  return sendCommand(options.client, "POST", "/v1/source-tiles", commandEnvelope(options.payload, null));
}

export function updateSourceTile(options: {
  client: ApiClient;
  sourceTileId: string;
  expectedRevision: number;
  payload: SourceTileUpdatePayload;
}): Promise<SourceTileCommandResult> {
  return sendCommand(options.client, "PUT", `/v1/source-tiles/${options.sourceTileId}`, commandEnvelope(options.payload, options.expectedRevision));
}

export function reflowSourceTile(options: {
  client: ApiClient;
  sourceTileId: string;
  expectedRevision: number;
  range: UtcSpan;
}): Promise<SourceTileCommandResult> {
  return sendCommand(options.client, "POST", `/v1/source-tiles/${options.sourceTileId}/reflow`, commandEnvelope({ range: options.range }, options.expectedRevision));
}

export function getSourceTile(client: ApiClient, sourceTileId: string): Promise<Result<SourceTileDetail>> {
  return getRead(client, `/v1/source-tiles/${sourceTileId}`);
}

export function listSourceTilePlacements(client: ApiClient, sourceTileId: string): Promise<Result<PlacementRead[]>> {
  return getRead(client, `/v1/source-tiles/${sourceTileId}/placements`);
}
