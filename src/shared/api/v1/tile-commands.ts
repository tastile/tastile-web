import { PlacementSource, PlanRole, RecurringState, TileKind } from "@/tile/model/v1/constants";
import { type ApiError, type CommandRequest, nowIso, uuidv7 } from "@/tile/model/v1/envelope";
import { type ApiClient, type Result, postCommand, sendCommand } from "./endpoints";

type CommandResult = Result<import("@/tile/model/v1/envelope").CommandResponse>;

export interface CreateTileOptions {
  client: ApiClient;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  ownerSubjectId?: string | null;
}

export interface UpdateTileOptions {
  client: ApiClient;
  tileId: string;
  title?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  externalId?: string | null;
  ownerSubjectId?: string | null;
}

export interface UpdatePlacementChangesOptions {
  client: ApiClient;
  /** Placement aggregate id (the `editingId` from the store when editing a placement). */
  placementId: string;
  /** ISO 8601 span start (DateTime<Utc>). */
  start: string;
  /** ISO 8601 span end (DateTime<Utc>). */
  end: string;
}

export interface StartTileOptions {
  client: ApiClient;
  tileId: string;
  planId: string;
  start: string;
  end: string;
}

export type StartTileExecutionResult =
  | { ok: true; placementId: string; executionId: string | null }
  | { ok: false; error: ApiError };

type RecurrencePattern =
  | { kind: "daily" }
  | {
      kind: "weekly" /** Weekday bitmask.  bit 0=Mon..6=Sun (matches v1/05 CalendarTerm). */;
      weekdays: number;
    }
  | { kind: "monthly"; dayOfMonth: number };

export interface CreateRecurringOptions {
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

export async function createTileCommand(options: CreateTileOptions): Promise<CommandResult> {
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

/// True when the legacy Recurring writer path may run from the Web client.
/// Per `v1/02` Recurring is legacy read compatibility; per `v1/10` sec.9
/// the canonical new-spec path is `POST /v1/source-tiles`.  Mirror the
/// server-side gate in `auth.rs::default_break_seed_enabled` and
/// `migrations.rs::legacy_default_break_seed_enabled` so the Recurring
/// tile -> placement chain cannot be entered from the Web UI either.
function legacyRecurringWriteEnabled(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  const raw = process.env.NEXT_PUBLIC_TASTILE_LEGACY_RECURRING_WRITE;
  return raw === "1" || raw === "true" || raw === "yes";
}

export async function createRecurringCommand(
  options: CreateRecurringOptions,
): Promise<CreateRecurringResult> {
  if (!legacyRecurringWriteEnabled()) {
    return {
      ok: false,
      error: {
        kind: 0,
        message: "createRecurringCommand is disabled; use POST /v1/source-tiles",
        currentRevision: null,
        violations: [],
      },
      stage: "tile",
    };
  }
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

export async function updateTileCommand(options: UpdateTileOptions): Promise<CommandResult> {
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

/**
 * Reschedule a placement by updating its baseline span.
 *
 * POST /v1/placements/{id}/changes
 * Body: { placement_id, baseline: { span: { start, end }, inside: null } }
 */
export function updatePlacementChanges(
  options: UpdatePlacementChangesOptions,
): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/placements/${options.placementId}/changes`,
    envelope({
      placement_id: options.placementId,
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

function startTileCommand(options: StartTileOptions): Promise<CommandResult> {
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
// pause_execution / resume_execution take a unit payload (the path carries
// execution_id), so the wire body is the envelope with payload=null.
// finish_execution sends the finish kind and optional note.
//
// Wire mapping (verified end-to-end):
//   kind = 0 -> state = FinishedNormal (2 in ExecutionState)
//   kind = 1 -> state = FinishedVoid    (3 in ExecutionState)

export function pauseExecutionCommand(options: {
  client: ApiClient;
  executionId: string;
}): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/executions/${options.executionId}/pause`,
    envelope(null),
  );
}

export function resumeExecutionCommand(options: {
  client: ApiClient;
  executionId: string;
}): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/executions/${options.executionId}/resume`,
    envelope(null),
  );
}

export interface FinishExecutionOptions {
  client: ApiClient;
  executionId: string;
  kind?: number;
  note?: string | null;
}

export function finishExecutionCommand(options: FinishExecutionOptions): Promise<CommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/executions/${options.executionId}/finish`,
    envelope({
      kind: options.kind ?? 0,
      note: options.note ?? null,
    }),
  );
}

export async function startTileExecutionCommand(
  options: StartTileOptions,
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

interface CreatePlacementOptions {
  client: ApiClient;
  tileId: string;
  planId: string;
  start: string;
  end: string;
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
 * (kind=PLACEMENT) so the QuickCreate manual path is fully v1.
 */
function createPlacementCommand(options: CreatePlacementOptions): Promise<CommandResult> {
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
 * QuickCreate manual path.
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
