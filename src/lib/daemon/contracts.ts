import type {
  ExecutionSnapshot,
  InProgressTileSnapshot,
  PhaseKind,
  PromptAction,
  PromptKind,
  PromptQueueItemSnapshot,
  PromptQueueStatus,
  PromptSeverity,
  TimelineItemSnapshot,
  TimelineItemStatus,
  TimelineItemType,
} from "../domain/execution";
import { normalizeTileId } from "../domain/ids";

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export function parseExecutionSnapshot(raw: unknown): ExecutionSnapshot {
  const root = asRecord(raw, "snapshot");
  const inProgressTiles = asArray(read(root, "in_progress_tiles"), "in_progress_tiles").map(
    parseInProgressTile,
  );
  const promptQueue = asArray(read(root, "prompt_queue"), "prompt_queue").map(parsePromptQueueItem);
  const timeline = asArray(read(root, "timeline"), "timeline").map(parseTimelineItem);

  return { inProgressTiles, promptQueue, timeline };
}

function parseInProgressTile(raw: unknown): InProgressTileSnapshot {
  const row = asRecord(raw, "in_progress_tiles[]");
  const tileId = normalizeTileId(asString(read(row, "tile_id"), "tile_id"));
  if (!tileId) {
    throw new Error("Invalid tile_id: expected UUID or urn:uuid:UUID");
  }
  return {
    tileId,
    title: asString(read(row, "title"), "title"),
    phaseKind: asPhaseKind(read(row, "phase_kind")),
    startedAt: asDate(read(row, "started_at"), "started_at"),
    phaseEndsAt:
      readOptional(row, "phase_ends_at") === undefined
        ? null
        : asNullableDate(readOptional(row, "phase_ends_at"), "phase_ends_at"),
    tz:
      readOptional(row, "tz") === undefined
        ? null
        : asNullableString(readOptional(row, "tz"), "in_progress_tiles[].tz"),
  };
}

function parsePromptQueueItem(raw: unknown): PromptQueueItemSnapshot {
  const row = asRecord(raw, "prompt_queue[]");
  return {
    promptId: asString(read(row, "prompt_id"), "prompt_id"),
    tileId: asNullableTileId(read(row, "tile_id"), "tile_id"),
    kind: asPromptKind(read(row, "kind")),
    severity: asPromptSeverity(read(row, "severity")),
    title: asNullableString(readOptional(row, "title"), "title"),
    body: asNullableString(readOptional(row, "body"), "body"),
    why: asNullableString(readOptional(row, "why"), "why"),
    suggestedMinutes: asNullableNumber(read(row, "suggested_minutes"), "suggested_minutes"),
    reasons: asStringArray(read(row, "reasons"), "reasons"),
    actions: asPromptActionArray(read(row, "actions"), "actions"),
    scheduledAt: asDate(read(row, "scheduled_at"), "scheduled_at"),
    reason: asString(read(row, "reason"), "reason"),
    status: asPromptQueueStatus(read(row, "status")),
    expiresAt:
      readOptional(row, "expires_at") === undefined
        ? null
        : asNullableDate(readOptional(row, "expires_at"), "expires_at"),
    stale: asOptionalBoolean(readOptional(row, "stale")) ?? false,
    tz:
      readOptional(row, "tz") === undefined
        ? null
        : asNullableString(readOptional(row, "tz"), "prompt_queue[].tz"),
  };
}

function parseTimelineItem(raw: unknown): TimelineItemSnapshot {
  const row = asRecord(raw, "timeline[]");
  const durationRaw = readOptional(row, "duration_min");
  const durationMin =
    durationRaw === undefined ? null : asNullableNumber(durationRaw, "duration_min");
  return {
    id: asString(read(row, "id"), "id"),
    tileId: asNullableTileId(read(row, "tile_id"), "tile_id"),
    title: asString(read(row, "title"), "title"),
    type: asTimelineItemType(read(row, "type")),
    status: asTimelineItemStatus(read(row, "status")),
    startAt: asDate(read(row, "start_at"), "start_at"),
    endAt: asNullableDate(read(row, "end_at"), "end_at"),
    durationMin,
    tz:
      readOptional(row, "tz") === undefined
        ? null
        : asNullableString(readOptional(row, "tz"), "timeline[].tz"),
  };
}

function read(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) return source[key];
  }
  throw new Error(`Missing required field: ${keys[0]}`);
}

function readOptional(source: Record<string, unknown>, key: string): unknown | undefined {
  return key in source ? source[key] : undefined;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  throw new Error(`Invalid ${field}: expected object`);
}

function asArray(value: unknown, field: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new Error(`Invalid ${field}: expected array`);
}

function asString(value: unknown, field: string): string {
  if (typeof value === "string") return value;
  throw new Error(`Invalid ${field}: expected string`);
}

function asNullableTileId(value: unknown, field: string) {
  if (value === null) return null;
  const raw = asString(value, field);
  return normalizeTileId(raw);
}

function asNullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`Invalid ${field}: expected number|null`);
}

function asNullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  throw new Error(`Invalid ${field}: expected string|null`);
}

function asOptionalBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  throw new Error("Invalid boolean field");
}

function asDate(value: unknown, field: string): Date {
  if (typeof value === "string" && ISO_UTC_PATTERN.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  throw new Error(`Invalid ${field}: expected ISO date string`);
}

function asNullableDate(value: unknown, field: string): Date | null {
  if (value === null) return null;
  return asDate(value, field);
}

function asStringArray(value: unknown, field: string): string[] {
  return asArray(value, field).map((item, index) => asString(item, `${field}[${index}]`));
}

function asPromptActionArray(value: unknown, field: string): PromptAction[] {
  return asArray(value, field).map((item, index) => asPromptAction(item, `${field}[${index}]`));
}

function asPromptKind(value: unknown): PromptKind {
  const kind = asString(value, "kind");
  if (kind === "start_tile" || kind === "end_tile" || kind === "end_break") return kind;
  throw new Error(`Invalid kind: ${kind}`);
}

function asPromptSeverity(value: unknown): PromptSeverity {
  const severity = asString(value, "severity");
  if (severity === "soft" || severity === "elevated" || severity === "critical") return severity;
  throw new Error(`Invalid severity: ${severity}`);
}

function asPromptAction(value: unknown, field: string): PromptAction {
  const action = asString(value, field);
  if (
    action === "start_tile" ||
    action === "start_break_parallel" ||
    action === "start_break_split" ||
    action === "start_break_split_and_extend" ||
    action === "complete_phase" ||
    action === "complete_tile" ||
    action === "extend_phase" ||
    action === "defer_tile" ||
    action === "end_break" ||
    action === "confirm_continue" ||
    action === "confirm_stop_at" ||
    action === "confirm_executed" ||
    action === "confirm_skipped" ||
    action === "dismiss"
  ) {
    return action;
  }
  throw new Error(`Invalid ${field}: ${action}`);
}

function asPromptQueueStatus(value: unknown): PromptQueueStatus {
  const status = asString(value, "status");
  if (
    status === "pending" ||
    status === "acknowledged" ||
    status === "completed" ||
    status === "dismissed"
  ) {
    return status;
  }
  throw new Error(`Invalid status: ${status}`);
}

function asPhaseKind(value: unknown): PhaseKind {
  const phaseKind = asString(value, "phase_kind");
  if (phaseKind === "work" || phaseKind === "break" || phaseKind === "idle") return phaseKind;
  throw new Error(`Invalid phase_kind: ${phaseKind}`);
}

function asTimelineItemType(value: unknown): TimelineItemType {
  const type = asString(value, "type");
  if (type === "work" || type === "break" || type === "fixed") return type;
  throw new Error(`Invalid type: ${type}`);
}

function asTimelineItemStatus(value: unknown): TimelineItemStatus {
  const status = asString(value, "status");
  if (status === "done" || status === "active" || status === "scheduled") return status;
  throw new Error(`Invalid status: ${status}`);
}
