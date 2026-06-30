import { PlacementSource, PlanRole, TileKind } from "@/lib/domain/v1/constants";
import { type ApiError, type CommandRequest, nowIso, uuidv7 } from "@/lib/domain/v1/envelope";
import { type ApiClient, type Result, sendCommand } from "./endpoints";

type CommandResult = Result<import("@/lib/domain/v1/envelope").CommandResponse>;

export interface CreateTileCommandOptions {
  client: ApiClient;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  ownerSubjectId?: string | null;
}

export interface UpdateTileCommandOptions {
  client: ApiClient;
  tileId: string;
  title?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  externalId?: string | null;
  ownerSubjectId?: string | null;
}

export interface StartTileCommandOptions {
  client: ApiClient;
  tileId: string;
  planId: string;
  start: string;
  end: string;
}

export type StartTileExecutionResult =
  | { ok: true; placementId: string; executionId: string | null }
  | { ok: false; error: ApiError };

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

export async function createTileCommand(options: CreateTileCommandOptions): Promise<CommandResult> {
  const title = options.title.trim();
  if (!title) return emptyTitleError();
  return sendCommand(
    options.client,
    "POST",
    "/v1/tiles",
    envelope({
      kind: TileKind.PLACEMENT,
      title,
      description: options.description ?? null,
      color: options.color ?? "#3b82f6",
      icon: options.icon ?? "check-circle",
      external_id: null,
      plan_role: PlanRole.EXECUTABLE,
      owner_subject_id: options.ownerSubjectId ?? null,
    }),
  );
}

export async function updateTileCommand(options: UpdateTileCommandOptions): Promise<CommandResult> {
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
  if (options.ownerSubjectId !== undefined) {
    payload.owner_subject_id = options.ownerSubjectId;
  }

  return sendCommand(
    options.client,
    "POST",
    `/v1/tiles/${options.tileId}/update`,
    envelope(payload),
  );
}

export function startTileCommand(options: StartTileCommandOptions): Promise<CommandResult> {
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

export function startExecutionCommand(options: {
  client: ApiClient;
  placementId: string;
}): Promise<CommandResult> {
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
