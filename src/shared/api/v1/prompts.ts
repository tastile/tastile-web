// Core prompt inbox (tastile-core `/v1/prompts/*`): drift between plan and
// execution that needs the user's decision — a missed start, an execution still
// running past its span, a decision to make. Numeric codes mirror the Core
// registry (`domain::prompt`); no string enums are invented here.
import { nowIso, uuidv7 } from "@/shared/model/v1/envelope";
import { type ApiClient, type Result, getRead, postCommand } from "./endpoints";

export const PromptKind = {
  STARTUP_RECOVERY: 0,
  MISSED_START: 1,
  DECISION_REQUIRED: 2,
  STALE_ACTIVE_EXECUTION: 3,
} as const;

export const PromptResolution = {
  ACKNOWLEDGED: 0,
  DISMISSED: 1,
  ACTION_TAKEN: 2,
} as const;

/** AggregateKind codes used by prompt subjects. */
const SUBJECT_PLACEMENT = 1;
const SUBJECT_EXECUTION = 2;

export interface PromptView {
  id: string;
  kind: number;
  subject: { kind: number; id: string };
  note: string | null;
  created_at: string;
  expires_at: string | null;
}

interface PlacementRead {
  id: string;
  tile_id: string;
  span_start: string;
  span_end: string;
  source_tile_id: string | null;
}

interface ExecutionRead {
  id: string;
  tile_id: string;
  state: number;
  placement_id: string | null;
}

interface TileRead {
  id: string;
  title: string;
}

interface SourceRead {
  source: { schedule: { generation: { kind: number } } };
}

/** Core re-places a missed occurrence on reflow only for one-time and recurring sources. */
const RESCHEDULABLE_GENERATION_KINDS: readonly number[] = [0, 1];

/** What a prompt is about, resolved from its subject for display and actions. */
export interface PromptSubject {
  title: string | null;
  placementId: string | null;
  executionId: string | null;
  /** Set only when Core can re-place the occurrence from its source. */
  sourceTileId: string | null;
  spanStart: string | null;
  spanEnd: string | null;
}

export function listPendingPrompts(client: ApiClient): Promise<Result<PromptView[]>> {
  return getRead(client, "/v1/prompts/pending");
}

async function tileTitle(client: ApiClient, tileId: string): Promise<string | null> {
  const tile = await getRead<TileRead>(client, `/v1/tiles/${tileId}`);
  return tile.ok ? tile.data.title : null;
}

async function reschedulableSource(client: ApiClient, sourceTileId: string | null): Promise<string | null> {
  if (!sourceTileId) return null;
  const source = await getRead<SourceRead>(client, `/v1/source-tiles/${sourceTileId}`);
  if (!source.ok) return null;
  return RESCHEDULABLE_GENERATION_KINDS.includes(source.data.source.schedule.generation.kind)
    ? sourceTileId
    : null;
}

async function placementSubject(client: ApiClient, placementId: string): Promise<PromptSubject> {
  const placement = await getRead<PlacementRead>(client, `/v1/placements/${placementId}`);
  if (!placement.ok) {
    return { title: null, placementId, executionId: null, sourceTileId: null, spanStart: null, spanEnd: null };
  }
  const p = placement.data;
  return {
    title: await tileTitle(client, p.tile_id),
    placementId: p.id,
    executionId: null,
    sourceTileId: await reschedulableSource(client, p.source_tile_id),
    spanStart: p.span_start,
    spanEnd: p.span_end,
  };
}

/** Resolve the prompt's subject (placement or execution) into display facts. */
export async function describePromptSubject(
  client: ApiClient,
  prompt: PromptView,
): Promise<PromptSubject> {
  if (prompt.subject.kind === SUBJECT_PLACEMENT) {
    return placementSubject(client, prompt.subject.id);
  }
  if (prompt.subject.kind === SUBJECT_EXECUTION) {
    const execution = await getRead<ExecutionRead>(client, `/v1/executions/${prompt.subject.id}`);
    if (!execution.ok) {
      return { title: null, placementId: null, executionId: prompt.subject.id, sourceTileId: null, spanStart: null, spanEnd: null };
    }
    const base = execution.data.placement_id
      ? await placementSubject(client, execution.data.placement_id)
      : {
          title: await tileTitle(client, execution.data.tile_id),
          placementId: null,
          sourceTileId: null,
          spanStart: null,
          spanEnd: null,
        };
    return { ...base, executionId: execution.data.id };
  }
  return { title: null, placementId: null, executionId: null, sourceTileId: null, spanStart: null, spanEnd: null };
}

export function resolvePromptCommand(options: {
  client: ApiClient;
  promptId: string;
  resolution: number;
  note?: string | null;
}) {
  return postCommand(options.client, `/v1/prompts/${options.promptId}/resolve`, {
    expectedRevision: null,
    idempotencyKey: uuidv7(),
    occurredAt: nowIso(),
    payload: { resolution: options.resolution, response_note: options.note ?? null },
  });
}
