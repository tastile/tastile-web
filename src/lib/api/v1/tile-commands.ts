import { PlacementSource, PlanRole, RecurringState, TileKind } from "@/lib/domain/v1/constants";
import { type ApiError, type CommandRequest, nowIso, uuidv7 } from "@/lib/domain/v1/envelope";
import { type ApiClient, postCommand, type Result, sendCommand } from "./endpoints";
import { type StorePlanInput, toWireSetPlanBody } from "./plan-wire";

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

export type RecurrencePattern =
  | { kind: "daily" }
  | {
      kind: "weekly" /** Weekday bitmask.  bit 0=Mon..6=Sun (matches v1/05 CalendarTerm). */;
      weekdays: number;
    }
  | { kind: "monthly"; dayOfMonth: number };

export interface CreateRecurringCommandOptions {
  client: ApiClient;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  /**
   * Anchor (start) of the first occurrence.  When `pattern` is set we use
   * it only as the anchor day; the actual range of each occurrence comes
   * from `pattern` + `timeOfDay`.  Otherwise (legacy path) it is the
   * full start/end of a single materialize range.
   */
  start: string;
  end: string;
  /**
   * Optional repeat pattern.  When set, `createRecurringCommand` will
   * expand the first `occurrences` matching days (default 14) into
   * individual materialize calls so /v1/timeline shows a placement on
   * each occurrence.  When omitted the legacy single-materialize path
   * is used.
   */
  pattern?: RecurrencePattern;
  /**
   * Local time-of-day window applied to each occurrence.  Both are
   * "HH:MM" in the user's local zone (interpreted via `getTimezoneOffset`).
   * When omitted the legacy `start` / `end` window is used.
   */
  timeOfDay?: { start: string; end: string };
  /** How many occurrences to materialize (default 14, max 60). */
  occurrences?: number;
  /** Frame step duration in ms (e.g. 86_400_000 for daily). */
  stepMs?: number;
  /** Recurring state (defaults to ACTIVE). */
  recurringState?: number;
  /** Plan role (defaults to EXECUTABLE). */
  planRole?: number;
}

export type CreateRecurringResult =
  | {
      ok: true;
      tileId: string;
      frameRuleId: string;
      materializedPlacementIds: string[];
    }
  | { ok: false; error: ApiError; stage: "tile" | "materialize" };

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

/**
 * v1-spec "periodic tile → placement tile" complete processing.
 *
 * Creates a Recurring tile, adds a default Step FrameRule, and materializes
 * the first occurrence (range_start..range_end) as a Placement. Returns
 * the new tile id, the assigned frame rule id, and the materialized
 * placement ids. Subsequent occurrences (one per stepMs interval) are not
 * materialized here — the recurring tile is the durable record; the
 * worker can materialize additional occurrences on demand.
 */
// Local time-of-day parser.  Returns [hours, minutes] for an "HH:MM"
// string, or null on malformed input.  Validates that hours are 0..23
// and minutes 0..59.
function parseHm(s: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  if (h < 0 || h > 23 || mn < 0 || mn > 59) return null;
  return [h, mn];
}

// Convert a (date, "HH:MM") pair in the viewer's local zone to a UTC
// ISO string.  The anchorIso carries the viewer's offset implicitly
// (we use Date.parse + Date#getTimezoneOffset on the host).
function localToUtcIso(anchorIso: string, hm: string): string {
  const parsed = parseHm(hm);
  if (!parsed) throw new Error(`invalid time of day: ${hm}`);
  const [h, mn] = parsed;
  const d = new Date(anchorIso);
  // We want (date + h:mm) interpreted in the host's local zone.  Use
  // a fresh Date with the date components replaced; the constructor
  // uses the local zone for unspecified components.
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mn, 0, 0);
  return local.toISOString();
}

// JS Date#getDay: 0=Sun..6=Sat.  Map to v1/05 CalendarTerm bit layout
// (bit 0=Mon..6=Sun).
function jsDayToV1MaskBit(jsDay: number): number {
  // jsDay: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  // v1 bit: 0=Mon,1=Tue,2=Wed,3=Thu,4=Fri,5=Sat,6=Sun
  if (jsDay === 0) return 6;
  return jsDay - 1;
}

/**
 * Expand a recurrence pattern into per-occurrence materialize ranges.
 * Each range is the local-zone [start, end) for that occurrence day.
 * The output is sorted by range_start.
 */
function expandPatternRanges(
  anchorIso: string,
  pattern: RecurrencePattern,
  timeOfDay: { start: string; end: string } | undefined,
  legacyStartIso: string,
  legacyEndIso: string,
  occurrenceCount: number,
): Array<{ start: string; end: string }> {
  if (occurrenceCount <= 0) return [];
  const anchor = new Date(anchorIso);
  if (Number.isNaN(anchor.getTime())) return [];
  const out: Array<{ start: string; end: string }> = [];
  const used = new Set<string>();
  const maxDays = 366; // hard cap to avoid runaway loops
  for (let dayOffset = 0; dayOffset < maxDays && out.length < occurrenceCount; dayOffset++) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + dayOffset);
    let include = false;
    if (pattern.kind === "daily") {
      include = true;
    } else if (pattern.kind === "weekly") {
      const bit = jsDayToV1MaskBit(d.getDay());
      include = (pattern.weekdays & (1 << bit)) !== 0;
    } else {
      // monthly: include when the day-of-month matches.
      include = d.getDate() === pattern.dayOfMonth;
    }
    if (!include) continue;
    const dayAnchorIso = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      anchor.getHours(),
      anchor.getMinutes(),
      0,
      0,
    ).toISOString();
    let startIso: string;
    let endIso: string;
    if (timeOfDay) {
      startIso = localToUtcIso(dayAnchorIso, timeOfDay.start);
      endIso = localToUtcIso(dayAnchorIso, timeOfDay.end);
      if (Date.parse(endIso) <= Date.parse(startIso)) {
        // Skip degenerate ranges (e.g. 00:00-00:00).  Caller can fix
        // by providing a non-zero duration.
        continue;
      }
    } else {
      // Fall back to the legacy single-occurrence window for the first
      // emit only; subsequent occurrences reuse the same offset from
      // the day anchor.
      if (out.length === 0) {
        startIso = legacyStartIso;
        endIso = legacyEndIso;
      } else {
        const offsetMs = Date.parse(legacyEndIso) - Date.parse(legacyStartIso);
        const dayStart = new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          new Date(legacyStartIso).getHours(),
          new Date(legacyStartIso).getMinutes(),
          0,
          0,
        );
        startIso = dayStart.toISOString();
        endIso = new Date(dayStart.getTime() + offsetMs).toISOString();
      }
    }
    const key = `${startIso}|${endIso}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({ start: startIso, end: endIso });
  }
  return out;
}

export async function createRecurringCommand(
  options: CreateRecurringCommandOptions,
): Promise<CreateRecurringResult> {
  const title = options.title.trim();
  if (!title) return { ...emptyTitleError(), stage: "tile" };
  if (!options.start || !options.end) {
    return {
      ok: false,
      error: {
        kind: 0,
        message: "start and end are required",
        currentRevision: null,
        violations: [],
      },
      stage: "tile",
    };
  }

  // 1) Create the Recurring tile + first FrameRule in ONE request.
  // Plan 2026-07-07-v1-recurring-atomic-frame.md collapses the prior
  // 3-step flow (tile → frame-rule → materialize) so v1/10 §4 holds —
  // a single POST /v1/tiles produces both v1_recurring AND
  // v1_recurring_frame_rule atomically, with no orphan window.
  // The server assigns the frame_rule_id; we send a placeholder and
  // read the canonical id back via aggregate_meta.
  const stepMs = options.stepMs ?? 86_400_000;
  const tileRes = await sendCommand(
    options.client,
    "POST",
    "/v1/tiles",
    envelope({
      kind: TileKind.RECURRING,
      title,
      description: options.description ?? null,
      color: options.color ?? "#3b82f6",
      icon: options.icon ?? "check-circle",
      external_id: null,
      plan_role: options.planRole ?? PlanRole.EXECUTABLE,
      owner_subject_id: null,
      frame_rule: {
        id: "00000000-0000-0000-0000-000000000000",
        active: null,
        rank: 0,
        generator: {
          Step: { step: stepMs, origin: null, bounds: null },
        },
      },
    }),
  );
  if (!tileRes.ok) return { ...tileRes, stage: "tile" };
  const tileId = tileRes.data.aggregate?.id;
  if (!tileId) {
    return {
      ok: false,
      error: {
        kind: 7,
        message: "create tile response missing aggregate id",
        currentRevision: null,
        violations: [],
      },
      stage: "tile",
    };
  }

  const assignedFrameRuleId = tileRes.data.aggregateMeta?.frameRuleId;
  if (!assignedFrameRuleId) {
    return {
      ok: false,
      error: {
        kind: 7,
        message: "create tile response missing aggregate_meta.frame_rule_id",
        currentRevision: null,
        violations: [],
      },
      stage: "tile",
    };
  }

  // 2) Materialize occurrences.
  //
  //   - When `pattern` is provided, expand the first `occurrences`
  //     matching days into one materialize call each.  Each call uses
  //     the per-occurrence range (typically 1 hour, set via timeOfDay).
  //     The server creates one placement per call, so /v1/timeline
  //     shows a placement on every matching day.
  //
  //   - When `pattern` is omitted we keep the legacy behaviour: one
  //     materialize using the literal start/end as the placement span.
  const ranges = options.pattern
    ? expandPatternRanges(
        options.start,
        options.pattern,
        options.timeOfDay,
        options.start,
        options.end,
        Math.min(60, Math.max(1, options.occurrences ?? 14)),
      )
    : [{ start: options.start, end: options.end }];
  if (ranges.length === 0) {
    return {
      ok: false,
      error: {
        kind: 0,
        message: "pattern produced no occurrences (check time-of-day / weekdays)",
        currentRevision: null,
        violations: [],
      },
      stage: "materialize",
    };
  }
  const materializedPlacementIds: string[] = [];
  for (const range of ranges) {
    const matRes = await sendCommand(
      options.client,
      "POST",
      `/v1/recurring/${tileId}/frame-rules/${assignedFrameRuleId}/materialize`,
      envelope({
        recurring_id: tileId,
        frame_rule_id: assignedFrameRuleId,
        range_start: range.start,
        range_end: range.end,
      }),
    );
    if (!matRes.ok) return { ...matRes, stage: "materialize" };
  }

  return {
    ok: true,
    tileId,
    frameRuleId: assignedFrameRuleId,
    materializedPlacementIds,
  };
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

// ---------- v1 SET_PLAN (POST /v1/tiles/{tileId}/plan) ----------

export interface SetPlanCommandOptions {
  client: ApiClient;
  tileId: string;
  /**
   * Loose `unknown` types at the API boundary — the converter
   * (`toWireSetPlanBody`) requires a strict `StorePlanInput` shape and
   * we cast at the call site because the source-of-truth is the typed
   * QuickCreate store (`useQuickCreateStore.plan`). Keeping the public
   * surface loose means callers can pass a `Plan` directly without an
   * adapter layer.
   */
  role: number;
  references: unknown;
  completion: unknown;
  planning: unknown;
  metrics: unknown[];
  decisions: unknown[];
}

/**
 * v1 plan-structure command.  Tile creation is separate from plan structure
 * (see v1/14 §2 and SetPlanPayload in `domain::command`): the first POST
 * /v1/tiles writes the Tile row + an auto-created Plan row; subsequent edits
 * to references / completion / planning / metrics / decisions go through
 * POST /v1/tiles/{tileId}/plan so the wire form carries the full Plan body.
 *
 * The plan-shape fields are typed `unknown` at this boundary; the
 * converter `toWireSetPlanBody` rewrites both the key naming
 * (camelCase → snake_case) AND the Condition/Term discriminated-union
 * shape (internally-tagged `{kind, value}` → externally-tagged
 * `{"Variant": {...}}`) plus TaskContent (note → description) and
 * TimeRequirement.required ({minMs, maxMs} → {min, max}) plus
 * TimeObservation.reference (default null). See plan-wire.ts for the
 * rewrite rules.
 */
export function setPlanCommand(options: SetPlanCommandOptions): Promise<CommandResult> {
  const storePlan: StorePlanInput = {
    role: options.role,
    references: options.references as StorePlanInput["references"],
    completion: options.completion as StorePlanInput["completion"],
    planning: options.planning as StorePlanInput["planning"],
    metrics: options.metrics,
    decisions: options.decisions,
  };
  const wire = toWireSetPlanBody(storePlan);
  return sendCommand(
    options.client,
    "POST",
    `/v1/tiles/${options.tileId}/plan`,
    envelope({
      tile_id: options.tileId,
      role: wire.role,
      references: wire.references,
      completion: wire.completion,
      planning: wire.planning,
      metrics: wire.metrics,
      decisions: wire.decisions,
    }),
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
      source: 0,
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

// ---------- v1 Execution lifecycle commands ----------
//
// pause_execution / resume_execution / finish_execution helpers were
// removed in the knip cleanup pass -- they were defined but never
// imported.  Add them back here only when a caller materialises.

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

// ---------- v1 placement commands (manual placement CRUD) ----------

export interface CreatePlacementCommandOptions {
  client: ApiClient;
  tileId: string;
  planId: string;
  start: string;
  end: string;
}

export interface UpdatePlacementSpanCommandOptions {
  client: ApiClient;
  placementId: string;
  start: string;
  end: string;
}

export interface ClosePlacementCommandOptions {
  client: ApiClient;
  placementId: string;
}

const emptySourceRef = () => ({
  created: null,
  recurring: null,
  flow: null,
  frame: null,
  proposal: null,
  source_text: null,
  external_id: null,
});

// v1 Span wire expects DateTime<Utc> (chrono RFC 3339).  Accept either a
// date-only "YYYY-MM-DD" (treated as that day at 00:00:00Z) or a full ISO
// 8601 string; reject anything else.  Without this normalisation a date
// like "2026-07-14" reaches the v1 server, chrono's deserialiser reads
// past the closing quote and the JSON parser reports "premature end of
// input" at the body boundary (HTTP 422).
function toSpanInstant(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return `${value}T00:00:00Z`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`span instant must be a date (YYYY-MM-DD) or ISO 8601 string, got: ${value}`);
  }
  return parsed.toISOString();
}

/**
 * Create a Placement aggregate for an existing Placement-tile.
 * POST /v1/placements with CREATE_PLACEMENT.  Use after POST /v1/tiles
 * (kind=PLACEMENT) so the QuickTileCreate manual path is fully v1.
 */
export function createPlacementCommand(
  options: CreatePlacementCommandOptions,
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    "/v1/placements",
    envelope({
      tile_id: options.tileId,
      plan_id: options.planId,
      source: PlacementSource.MANUAL,
      source_ref: emptySourceRef(),
      baseline: {
        span: {
          start: toSpanInstant(options.start),
          end: toSpanInstant(options.end),
        },
        inside: null,
      },
    }),
  );
}

// v1 wire constants for the AppendChanges payload.  Sent as one
// ChangeSet with two Change rows (SPAN_START, SPAN_END) per request.
// ChangeGroup::PLACEMENT = 5 (Key.group), ChangeLayer::PLACEMENT = 1,
// ChangeKind::Set = 0, MergeMode::Override = 0, ChangeSource::User = 2,
// ActorKind::User = 0.  Key parts: SPAN_START = 0, SPAN_END = 1.
const APPEND_CHANGE_GROUP_PLACEMENT = 5 as const;
const APPEND_CHANGE_LAYER_PLACEMENT = 1 as const;
const APPEND_CHANGE_KIND_SET = 0 as const;
const APPEND_CHANGE_MERGE_OVERRIDE = 0 as const;
const APPEND_CHANGE_SOURCE_USER = 2 as const;
const APPEND_CHANGE_ACTOR_USER = 0 as const;
const APPEND_CHANGE_PART_SPAN_START = 0 as const;
const APPEND_CHANGE_PART_SPAN_END = 1 as const;

/**
 * Build the v1 wire payload for POST /v1/placements/{id}/changes.
 *
 * The server expects an AppendChangesPayload:
 *   { placement_id, changeset: ChangeSet }
 * where ChangeSet is the full audit envelope (id / owner_id / target /
 * layer / rank / changes / activation / revoked / source / source_ref /
 * created_at / created_by).  We send SPAN_START and SPAN_END as two
 * `Change` rows in one ChangeSet to avoid two HTTP round trips and to
 * keep the audit envelope atomic.
 *
 * Wire shape (externally tagged, snake_case):
 *   payload.changeset.target           = { Placement: "<uuid>" }
 *   payload.changeset.changes[*].value = { Instant: "<iso-8601>" }
 */
function buildSpanChangesetPayload(
  placementId: string,
  start: string,
  end: string,
  ownerId: string,
  actorId: string,
) {
  const now = nowIso();
  const makeChange = (part: number, instant: string) => ({
    id: uuidv7(),
    key: {
      group: APPEND_CHANGE_GROUP_PLACEMENT,
      item: placementId,
      part,
    },
    kind: APPEND_CHANGE_KIND_SET,
    value: { Instant: instant },
    merge: APPEND_CHANGE_MERGE_OVERRIDE,
    source: APPEND_CHANGE_SOURCE_USER,
    source_ref: null,
    rank: 0,
  });
  return {
    placement_id: placementId,
    changeset: {
      id: uuidv7(),
      owner_id: ownerId,
      target: { Placement: placementId },
      layer: APPEND_CHANGE_LAYER_PLACEMENT,
      rank: 0,
      changes: [
        makeChange(APPEND_CHANGE_PART_SPAN_START, start),
        makeChange(APPEND_CHANGE_PART_SPAN_END, end),
      ],
      activation: { when: null, until: null },
      revoked: null,
      source: APPEND_CHANGE_SOURCE_USER,
      source_ref: null,
      created_at: now,
      created_by: {
        at: now,
        actor: actorId,
        actor_kind: APPEND_CHANGE_ACTOR_USER,
        command_id: uuidv7(),
      },
    },
  };
}

/**
 * Replace the baseline span (start + end) of an existing placement.
 *
 * v1 wire: one POST /v1/placements/{id}/changes carrying a single
 * ChangeSet with two `Change` rows:
 *   - Key { group: PLACEMENT(5), item: placementId, part: 0 } value=Instant(start)
 *   - Key { group: PLACEMENT(5), item: placementId, part: 1 } value=Instant(end)
 * The owner and actor ids must come from the caller; in E2E bypass mode
 * they are the DEV_ACTOR_SUBJECT_ID placeholder.
 */
export async function updatePlacementSpanCommand(
  options: UpdatePlacementSpanCommandOptions & {
    ownerSubjectId: string;
    actorSubjectId: string;
  },
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/placements/${options.placementId}/changes`,
    envelope(
      buildSpanChangesetPayload(
        options.placementId,
        options.start,
        options.end,
        options.ownerSubjectId,
        options.actorSubjectId,
      ),
    ),
  );
}
/** Soft-close a placement.  POST /v1/placements/{id}/close. */
export function closePlacementCommand(
  options: ClosePlacementCommandOptions,
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/placements/${options.placementId}/close`,
    envelope({ placement_id: options.placementId }),
  );
}

// ---------- end-to-end manual placement create ----------

export interface CreateManualPlacementOptions {
  client: ApiClient;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  start: string;
  end: string;
  /** Defaults to EXECUTABLE. */
  planRole?: number;
}

export type CreateManualPlacementResult =
  | { ok: true; tileId: string; planId: string; placementId: string }
  | { ok: false; error: ApiError; stage: "tile" | "read" | "placement" };

/**
 * End-to-end manual placement create:
 *   1. POST /v1/tiles (kind=PLACEMENT)  — auto-creates v1_plan row
 *   2. GET  /v1/tiles/{id}              — read back the auto plan_id
 *   3. POST /v1/placements             — bind the placement to the plan
 *
 * The full v1 flow replaces the v0 BFF POST /api/events for the
 * QuickTileCreate manual path.
 */
export async function createManualPlacementCommand(
  options: CreateManualPlacementOptions,
): Promise<CreateManualPlacementResult> {
  // 1) Create the Placement tile (kind=1).  Server also writes a v1_plan
  //    row in the same transaction and echoes plan_id back via
  //    aggregate_meta.plan_id (per plan §C).  No GET-after-POST.
  const title = options.title.trim();
  if (!title) {
    return {
      ok: false,
      stage: "tile",
      error: { kind: 0, message: "title is required", currentRevision: null, violations: [] },
    };
  }
  const tileRes = await createTileCommand({
    client: options.client,
    title,
    description: options.description ?? null,
    color: options.color ?? "#3b82f6",
    icon: options.icon ?? "check-circle",
  });
  if (!tileRes.ok) return { ...tileRes, stage: "tile" };
  const tileId = tileRes.data.aggregate?.id;
  if (!tileId) {
    return {
      ok: false,
      stage: "tile",
      error: {
        kind: 7,
        message: "create tile response missing id",
        currentRevision: null,
        violations: [],
      },
    };
  }
  const planId = tileRes.data.aggregateMeta?.planId;
  if (!planId) {
    return {
      ok: false,
      stage: "tile",
      error: {
        kind: 7,
        message:
          "create tile response missing aggregate_meta.plan_id (server did not auto-create v1_plan)",
        currentRevision: null,
        violations: [],
      },
    };
  }

  // 2) Create the Placement record (Manual source).
  const placementRes = await createPlacementCommand({
    client: options.client,
    tileId,
    planId,
    start: options.start,
    end: options.end,
  });
  if (!placementRes.ok) return { ...placementRes, stage: "placement" };
  const placementId = placementRes.data.aggregate?.id;
  if (!placementId) {
    return {
      ok: false,
      stage: "placement",
      error: {
        kind: 7,
        message: "create placement response missing id",
        currentRevision: null,
        violations: [],
      },
    };
  }
  return { ok: true, tileId, planId, placementId };
}

// Suppress unused-import warning when RecurringState is only consumed via
// the constants barrel.
void RecurringState;
void postCommand;
