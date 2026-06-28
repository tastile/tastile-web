import {
  PlanRole,
  PlacementSource,
  TileKind,
} from "@/lib/domain/v1/constants";
import {
  nowIso,
  uuidv7,
  type ApiError,
  type CommandRequest,
} from "@/lib/domain/v1/envelope";
import {
  sendCommand,
  type ApiClient,
  type Result,
} from "./endpoints";

type CommandResult = Result<import("@/lib/domain/v1/envelope").CommandResponse>;

export interface TileCommandOptions {
  client: ApiClient;
  tileId: string;
}

export interface CreateTileCommandOptions {
  client: ApiClient;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateTileCommandOptions extends TileCommandOptions {
  title?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  externalId?: string | null;
}

export interface DeferTileCommandOptions extends TileCommandOptions {
  deferredUntil: string;
}

export interface StartTileCommandOptions extends TileCommandOptions {
  planId: string;
  start: string;
  end: string;
}

export type StartTileExecutionResult =
  | { ok: true; placementId: string; executionId: string | null }
  | { ok: false; error: ApiError };

const TileLifecycleState = {
  ACTIVE: 0,
  DEFERRED: 1,
  COMPLETED: 2,
} as const;

function envelope<T>(payload: T): CommandRequest<T> {
  return {
    expectedRevision: null,
    idempotencyKey: uuidv7(),
    occurredAt: nowIso(),
    payload,
  };
}

function emptyTitleError(): { ok: false; error: ApiError } {
  return {
    ok: false,
    error: {
      kind: 0,
      message: "title is required",
      currentRevision: null,
      violations: [],
    },
  };
}

export async function createTileCommand(
  options: CreateTileCommandOptions,
): Promise<CommandResult> {
  const title = options.title.trim();
  if (!title) return emptyTitleError();
  return sendCommand(options.client, "POST", "/v1/tiles", envelope({
    kind: TileKind.PLACEMENT,
    title,
    description: options.description ?? null,
    color: options.color ?? "#3b82f6",
    icon: options.icon ?? "check-circle",
    external_id: null,
    plan_role: PlanRole.EXECUTABLE,
  }));
}

export async function updateTileCommand(
  options: UpdateTileCommandOptions,
): Promise<CommandResult> {
  const payload: Record<string, unknown> = { tile_id: options.tileId };
  if (options.title !== undefined) {
    const title = options.title.trim();
    if (!title) return emptyTitleError();
    payload.title = title;
  }
  if (options.description !== undefined) payload.description = options.description;
  if (options.color !== undefined) payload.color = options.color;
  if (options.icon !== undefined) payload.icon = options.icon;
  if (options.externalId !== undefined) payload.external_id = options.externalId;

  return sendCommand(
    options.client,
    "POST",
    `/v1/tiles/${options.tileId}/update`,
    envelope(payload),
  );
}

export function archiveTileCommand(
  options: TileCommandOptions,
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "DELETE",
    `/v1/tiles/${options.tileId}`,
    envelope({ tile_id: options.tileId }),
  );
}

export function completeTileCommand(
  options: TileCommandOptions,
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/tiles/${options.tileId}/complete`,
    envelope({
      tile_id: options.tileId,
      state: TileLifecycleState.COMPLETED,
      deferred_until: null,
      completed_at: nowIso(),
      bump_extend: false,
    }),
  );
}

export function deferTileCommand(
  options: DeferTileCommandOptions,
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/tiles/${options.tileId}/defer`,
    envelope({
      tile_id: options.tileId,
      state: TileLifecycleState.DEFERRED,
      deferred_until: options.deferredUntil,
      completed_at: null,
      bump_extend: false,
    }),
  );
}

export function extendTilePhaseCommand(
  options: TileCommandOptions,
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/tiles/${options.tileId}/extend-phase`,
    envelope({
      tile_id: options.tileId,
      state: TileLifecycleState.ACTIVE,
      deferred_until: null,
      completed_at: null,
      bump_extend: true,
    }),
  );
}

export function attachMemoCommand(
  options: TileCommandOptions & { body: string },
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/tiles/${options.tileId}/memos`,
    envelope({ tile_id: options.tileId, body: options.body }),
  );
}

export function startTileCommand(
  options: StartTileCommandOptions,
): Promise<CommandResult> {
  const sourceRef = {
    created: null,
    recurring: null,
    flow: null,
    frame: null,
    proposal: null,
    source_text: null,
    external_id: null,
  };
  return sendCommand(
    options.client,
    "POST",
    `/v1/tiles/${options.tileId}/start`,
    envelope({
      tile_id: options.tileId,
      plan_id: options.planId,
      source: PlacementSource.MANUAL,
      source_ref: sourceRef,
      baseline: {
        span: { start: options.start, end: options.end },
        inside: null,
      },
    }),
  );
}

export function startExecutionCommand(
  options: { client: ApiClient; placementId: string },
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/placements/${options.placementId}/executions`,
    envelope({ placement_id: options.placementId }),
  );
}

export async function startTileExecutionCommand(
  options: StartTileCommandOptions,
): Promise<StartTileExecutionResult> {
  const placement = await startTileCommand(options);
  if (!placement.ok) return { ok: false, error: placement.error };

  const placementId = placement.data.aggregate?.id;
  if (!placementId) {
    return {
      ok: false,
      error: {
        kind: 7,
        message: "start tile response missing placement aggregate",
        currentRevision: null,
        violations: [],
      },
    };
  }

  const execution = await startExecutionCommand({
    client: options.client,
    placementId,
  });
  if (!execution.ok) return { ok: false, error: execution.error };

  return {
    ok: true,
    placementId,
    executionId: execution.data.aggregate?.id ?? null,
  };
}
