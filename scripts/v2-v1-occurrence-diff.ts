#!/usr/bin/env bun
/**
 * web#219 item E — v2 scheduler candidate vs Core v1 materialization diff.
 *
 * Contract baseline: tastile-openapi v3.5.0 (submodule 8a61003). Core
 * release-1-1-0 owns monthly recurrence as SourceGenerationKind::Monthly
 * (kind=3 + monthly_rule), weekday_mask and excluded_dates on
 * generation; the SourceTile detail read returns them under
 * `source.schedule.generation` for read-back verification.
 *
 * For each synthetic schedule case this script:
 *   1. derives the v2 SchedulerEvalInput exactly like V2ScheduleEval does,
 *   2. runs the real tastile-v2 binary through evaluateSchedulerV2 twice
 *      (determinism check),
 *   3. submits the SAME QuickCreate state through the real v1 path
 *      (buildQuickCreateSchedulePayload -> POST /v1/schedule-definitions),
 *   4. polls GET /v1/source-tiles/{id} until occurrences/placements
 *      materialize (async worker) or a timeout distinguishes "pending"
 *      from "mismatch", and reads back `source.schedule.generation` to
 *      confirm which semantics Core actually stored,
 *   5. compares v2 CANDIDATE [start,end] pairs against v1 PLACEMENT
 *      [start,end] spans in the same range, then classifies the diff on
 *      two axes (see `classifyCase`):
 *        - cause: none / v2_input_gap / v1_period_boundary /
 *          suspected_regression / nondeterminism / pending
 *          (the issue's ① intended safety fix is reserved for cases
 *          where Core deliberately deviates, e.g. past-anchor clamps)
 *        - semantics: monthly_rule / weekday_mask / excluded_dates /
 *          period_boundary tags explaining WHICH authored rule shapes
 *          the divergence.
 *
 * IMPORTANT: v2 occurrences are advisory evaluation candidates produced
 * by the opt-in evaluator. They are NOT the placements Core will
 * materialize. Only the v1 submit -> worker path creates placements.
 *
 * All times are absolute UTC instants; offset_min is only used for display
 * and for mapping instants back to the authored local calendar dates.
 *
 * Usage:
 *   source /tmp/t13-web-env.sh
 *   bun scripts/v2-v1-occurrence-diff.ts [--out <dir>] [--cases a,b]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { buildDefaultQuickCreateState } from "../src/shared/stores/quick-create-store";
import { buildQuickCreateSchedulePayload } from "../src/shared/api/v1/quick-create-schedule-wire";
import { deriveV2SchedulerInput } from "../src/lib/v2-adapter/schedule-eval-input";
import {
  evaluateSchedulerV2,
  v2AdapterConfigFromEnv,
} from "../src/lib/v2-adapter/scheduler-eval";

const WEB = process.env.VERIFY_WEB ?? "http://localhost:3124";
const CORE = process.env.VERIFY_CORE ?? "http://127.0.0.1:31400";
const BRIDGE = process.env.TASTILE_WEB_BRIDGE_SECRET;
const OUT =
  process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : "/tmp/t13-evidence/219-diff";
const CASE_FILTER = process.argv.includes("--cases")
  ? process.argv[process.argv.indexOf("--cases") + 1].split(",")
  : null;
const POLL_TIMEOUT_MS = 150_000;
const POLL_INTERVAL_MS = 3_000;

if (!BRIDGE) {
  console.error("TASTILE_WEB_BRIDGE_SECRET is required");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const log = (...a: unknown[]) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// ---------- auth (normal session, same as verify-215) ----------
// One fresh user per case: sources from different cases must not share
// an owner, or their placements contend for the same wall-clock slots and
// the diff measures contention instead of schedule semantics.
async function makeSession(caseName: string) {
  const jar = new Map<string, string>();
  const storeCookies = (res: Response) => {
    const setCookies =
      res.headers.getSetCookie?.() ??
      (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")!] : []);
    for (const sc of setCookies) {
      const [pair] = sc.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  };
  const cookieHeader = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const webFetch = (url: string, init: RequestInit = {}) =>
    fetch(url, {
      ...init,
      headers: {
        origin: WEB,
        ...(init.headers as Record<string, string> | undefined),
        cookie: cookieHeader(),
      },
    });

  const email = `verify219-${caseName}-${Date.now().toString(36)}@example.com`;
  let su = await webFetch(`${WEB}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "verify-pass-123" }),
  });
  storeCookies(su);
  if (!su.ok) {
    su = await webFetch(`${WEB}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password: "verify-pass-123",
        name: `Verify 219 ${caseName}`,
      }),
    });
    storeCookies(su);
  }
  if (!su.ok) {
    throw new Error(`auth failed for ${caseName}: ${su.status} ${await su.text()}`);
  }
  await webFetch(`${WEB}/api/auth/bridge?next=/dashboard`, { redirect: "manual" });
  const sessRes = await webFetch(`${WEB}/api/auth/session`);
  storeCookies(sessRes);
  const sess = (await sessRes.json()) as { sub?: string };
  if (!sess.sub) throw new Error(`no session sub for ${caseName}`);
  return {
    sub: sess.sub,
    headers: {
      "content-type": "application/json",
      "x-tastile-web-bridge-secret": BRIDGE!,
      "x-tastile-web-session-user": sess.sub,
    } as Record<string, string>,
  };
}



// ---------- evalState mapping (mirrors V2ScheduleEval.tsx) ----------
type StoreState = ReturnType<typeof buildDefaultQuickCreateState>;
function evalStateOf(state: StoreState, nowMs: number) {
  return {
    repeatMode: state.recurring.repeatMode,
    intervalValue: state.recurring.intervalValue,
    intervalUnit: state.recurring.intervalUnit,
    recurringStart: state.time.span.start || state.recurring.life.active.startDate,
    recurringEnd:
      state.recurring.endDate || state.recurring.life.active.endDate || null,
    spanStart: state.time.span.start || null,
    spanEnd: state.time.span.end || null,
    durationMinMs: state.time.durationMinMax.minMs,
    durationMaxMs: state.time.durationMinMax.maxMs,
    requirementMinMs:
      state.plan.completion.timeRequirements[0]?.required?.minMs ?? null,
    requirementMaxMs:
      state.plan.completion.timeRequirements[0]?.required?.maxMs ?? null,
    windowBounds: state.windows.map((w) => ({
      start: w.bounds.start,
      end: w.bounds.end,
    })),
    nowMs,
  };
}


// The wire requires durationMinMax to be mirrored into the first
// completion TimeRequirement (same invariant the UI maintains).
function setDuration(state: StoreState, minMs: number | null, maxMs: number | null) {
  state.time = {
    ...state.time,
    durationMinMax: { minMs, maxMs },
  };
  const reqs = state.plan.completion.timeRequirements;
  if (reqs[0]) {
    state.plan = {
      ...state.plan,
      completion: {
        ...state.plan.completion,
        timeRequirements: reqs.map((r, i) =>
          i === 0 ? { ...r, required: { ...r.required, minMs, maxMs } } : r,
        ),
      },
    };
  }
}

// ---------- case definitions ----------
const HOUR = 3_600_000;
const DAY = 86_400_000;

interface CaseDef {
  name: string;
  /** Stagger anchors so concurrent test sources do not compete for the
   *  same wall-clock slots (v1 placements conflict across sources). */
  anchorOffsetMs: number;
  apply(state: StoreState, now: Date, anchor: Date): void;
}

function baseState(now: Date): StoreState {
  const state = buildDefaultQuickCreateState();
  state.identity = { ...state.identity, title: "" };
  state.source = { ...state.source, offsetMin: 540 }; // JST, deterministic
  return state;
}

const cases: CaseDef[] = [
  {
    name: "daily-basic",
    anchorOffsetMs: 0,
    apply(state, now, anchor) {
      state.identity = { ...state.identity, title: "diff-daily" };
      state.recurring = { ...state.recurring, repeatMode: "daily" };
      state.time = {
        ...state.time,
        timeModel: "duration_only",
        span: { start: anchor.toISOString(), end: "" },
      };
      setDuration(state, HOUR, null);
    },
  },
  {
    name: "weekly-mask-30m",
    anchorOffsetMs: 2 * HOUR,
    apply(state, now, anchor) {
      state.identity = { ...state.identity, title: "diff-weekly" };
      state.recurring = {
        ...state.recurring,
        repeatMode: "weekly",
        weekdayMask: 0b0011111, // Mon-Fri
        intervalValue: 30,
        intervalUnit: "min",
        endDate: new Date(now.getTime() + 14 * DAY).toISOString(),
      };
      state.time = {
        ...state.time,
        timeModel: "duration_only",
        span: { start: anchor.toISOString(), end: "" },
      };
      setDuration(state, 30 * 60_000, null);
    },
  },
  {
    name: "monthly-by-day-15",
    anchorOffsetMs: 4 * HOUR,
    apply(state, now, anchor) {
      state.identity = { ...state.identity, title: "diff-monthly" };
      state.recurring = {
        ...state.recurring,
        repeatMode: "monthly",
        monthlyKind: "by_day",
        monthlyDayOfMonth: 15,
        endDate: new Date(now.getTime() + 60 * DAY).toISOString(),
      };
      state.time = {
        ...state.time,
        timeModel: "duration_only",
        span: { start: anchor.toISOString(), end: "" },
      };
      setDuration(state, HOUR, null);
    },
  },
  {
    name: "interval-12h",
    anchorOffsetMs: 6 * HOUR,
    apply(state, now, anchor) {
      state.identity = { ...state.identity, title: "diff-interval" };
      state.recurring = {
        ...state.recurring,
        repeatMode: "interval",
        intervalValue: 12,
        intervalUnit: "hour",
        endDate: new Date(now.getTime() + 14 * DAY).toISOString(),
      };
      state.time = {
        ...state.time,
        timeModel: "duration_only",
        span: { start: anchor.toISOString(), end: "" },
      };
      setDuration(state, HOUR, null);
    },
  },
  {
    name: "daily-excluded",
    anchorOffsetMs: 8 * HOUR,
    apply(state, now, anchor) {
      state.identity = { ...state.identity, title: "diff-excluded" };
      state.recurring = { ...state.recurring, repeatMode: "daily" };
      // Exclude two dates inside the horizon (UTC dates, JST offset +9).
      const d1 = new Date(now.getTime() + 2 * DAY);
      const d2 = new Date(now.getTime() + 4 * DAY);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      state.source = {
        ...state.source,
        excludedDates: [fmt(d1), fmt(d2)],
      };
      state.time = {
        ...state.time,
        timeModel: "duration_only",
        span: { start: anchor.toISOString(), end: "" },
      };
      setDuration(state, HOUR, null);
    },
  },
];

// ---------- comparison ----------
interface V1Occurrence {
  occurrence_id: string;
  nominal_at: string;
  window_start: string;
  window_end: string;
  required_duration_ms: number;
  state: number;
}
interface V1Placement {
  placement_id: string;
  occurrence_id: string;
  split_index: number;
  split_count: number;
  start: string;
  end: string;
  closed: boolean;
}
// Read-back of what Core actually stored (OpenAPI v3.5.0:
// SourceTileRead.schedule -> SourceScheduleDefinitionSchema.generation).
// Used to distinguish "Core dropped authored semantics" (regression) from
// "the v2 eval port cannot express them" (input information loss).
interface V1Generation {
  kind?: number;
  interval_ms?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  monthly_rule?: {
    kind?: number;
    day_of_month?: number | null;
    week_of_month?: number | null;
    weekday?: number | null;
  } | null;
  weekday_mask?: number | null;
  excluded_dates?: string[];
  date_range_start?: string | null;
  date_range_end?: string | null;
  offset_min?: number | null;
}
// v1/14 §15 list contract: detail reads return { items, count,
// next_cursor } envelopes (OpenAPI v3.3.0+), not bare arrays.
type ListEnvelope<T> = {
  items?: T[];
  count?: number;
  next_cursor?: string | null;
};
interface SourceDetailRaw {
  source: {
    source_tile_id: string;
    schedule?: { generation?: V1Generation | null } | null;
  };
  occurrences?: ListEnvelope<V1Occurrence> | V1Occurrence[];
  placements?: ListEnvelope<V1Placement> | V1Placement[];
}
interface SourceDetail {
  source: SourceDetailRaw["source"];
  occurrences: V1Occurrence[];
  placements: V1Placement[];
}

function listItems<T>(v: ListEnvelope<T> | T[] | undefined): T[] {
  if (Array.isArray(v)) return v;
  return v?.items ?? [];
}

// Fetch the source-tile detail with both collections fully materialized.
// The §15 envelopes page independently (occurrence_cursor /
// placement_cursor); advance each cursor until both are exhausted.
async function fetchDetailFull(
  sourceTileId: string,
  headers: Record<string, string>,
): Promise<SourceDetail | null> {
  const occurrences: V1Occurrence[] = [];
  const placements: V1Placement[] = [];
  let occCursor: string | null = null;
  let plcCursor: string | null = null;
  let source: SourceDetailRaw["source"] | null = null;
  for (let page = 0; page < 50; page++) {
    const u = new URL(`${CORE}/v1/source-tiles/${sourceTileId}`);
    u.searchParams.set("occurrence_limit", "1000");
    u.searchParams.set("placement_limit", "1000");
    if (occCursor) u.searchParams.set("occurrence_cursor", occCursor);
    if (plcCursor) u.searchParams.set("placement_cursor", plcCursor);
    const r = await fetch(u.toString(), { headers });
    const d = (await r.json().catch(() => null)) as SourceDetailRaw | null;
    if (!d) return null;
    source = d.source;
    occurrences.push(...listItems(d.occurrences));
    placements.push(...listItems(d.placements));
    const occEnv = Array.isArray(d.occurrences) ? null : d.occurrences;
    const plcEnv = Array.isArray(d.placements) ? null : d.placements;
    occCursor = occEnv?.next_cursor ?? null;
    plcCursor = plcEnv?.next_cursor ?? null;
    const occDone = !occCursor || occurrences.length >= (occEnv?.count ?? Infinity);
    const plcDone = !plcCursor || placements.length >= (plcEnv?.count ?? Infinity);
    if (occDone && plcDone) break;
  }
  return source ? { source, occurrences, placements } : null;
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const v = Date.parse(iso);
  return Number.isFinite(v) ? v : null;
}

// ---------- schedule-semantics model ----------
// Which authored recurrence semantics the case exercises, derived from
// the same QuickCreate state that feeds BOTH the v2 derivation and the
// v1 wire. The v2 SchedulerEvalInput port is a fixed-step model
// (step_ms/span_ms/origin/bounds/range); it has no selector for
// weekday_mask, monthly_rule or excluded_dates, so candidates for those
// rules are "information loss" on the v2 side, not Core regressions.
type ScheduleSemantic =
  | "monthly_rule"
  | "weekday_mask"
  | "excluded_dates"
  | "period_boundary";

interface CaseSemantics {
  repeatMode: string;
  /** Wire-level generation.kind the v1 submit should produce. */
  expectedGenerationKind: number;
  weekdayMask: number | null;
  excludedDates: string[];
  monthlyKind: string | null;
  monthlyDayOfMonth: number | null;
  monthlyWeekOfMonth: number | null;
  monthlyWeekday: number | null;
  offsetMin: number;
  /** v2 eval step actually sent (DAY_MS for monthly = known approximation). */
  v2StepMs: number | null;
}

function semanticsOf(state: StoreState, stepMs: number | null): CaseSemantics {
  const r = state.recurring;
  const expectedKind =
    r.repeatMode === "once"
      ? 0
      : r.repeatMode === "condition"
        ? 2
        : r.repeatMode === "monthly"
          ? 3
          : 1;
  return {
    repeatMode: r.repeatMode,
    expectedGenerationKind: expectedKind,
    weekdayMask:
      r.repeatMode === "weekly" ? (r.weekdayMask & 0b1111111) : null,
    excludedDates: [...state.source.excludedDates],
    monthlyKind: r.repeatMode === "monthly" ? (r.monthlyKind ?? null) : null,
    monthlyDayOfMonth:
      r.repeatMode === "monthly" ? (r.monthlyDayOfMonth ?? null) : null,
    monthlyWeekOfMonth:
      r.repeatMode === "monthly" ? (r.monthlyWeekOfMonth ?? null) : null,
    monthlyWeekday:
      r.repeatMode === "monthly" ? (r.monthlyWeekday ?? null) : null,
    offsetMin: state.source.offsetMin,
    v2StepMs: stepMs,
  };
}

// Local wall-clock fields for an instant under the source offset.
// offset_min is minutes east of UTC (540 = JST).
function localParts(epochMs: number, offsetMin: number) {
  const d = new Date(epochMs + offsetMin * 60_000);
  return {
    date: d.toISOString().slice(0, 10),
    dayOfMonth: d.getUTCDate(),
    // JS getUTCDay: 0=Sun..6=Sat -> ISO weekday 1=Mon..7=Sun
    isoWeekday: ((d.getUTCDay() + 6) % 7) + 1,
  };
}

// Does `epochMs` fall on a date the authored monthly_rule selects?
function matchesMonthlyRule(
  epochMs: number,
  sem: CaseSemantics,
): boolean | null {
  if (sem.monthlyKind === "by_day") {
    if (sem.monthlyDayOfMonth === null) return null;
    return (
      localParts(epochMs, sem.offsetMin).dayOfMonth === sem.monthlyDayOfMonth
    );
  }
  if (sem.monthlyKind === "by_weekday") {
    const { isoWeekday } = localParts(epochMs, sem.offsetMin);
    // Store weekday is JS Sunday-first (0=Sun); wire converts to ISO.
    const authoredIso =
      sem.monthlyWeekday === 0 ? 7 : (sem.monthlyWeekday ?? -1);
    if (isoWeekday !== authoredIso) return false;
    const week = sem.monthlyWeekOfMonth;
    if (week === null) return null;
    if (week === 5) {
      // "last": the next same-weekday date falls in the next month.
      const { date } = localParts(epochMs, sem.offsetMin);
      const base = Date.parse(`${date}T00:00:00Z`);
      const next = new Date(base + 7 * 86_400_000);
      return next.getUTCMonth() !== new Date(base).getUTCMonth();
    }
    return (
      Math.ceil(localParts(epochMs, sem.offsetMin).dayOfMonth / 7) === week
    );
  }
  return null;
}

// Tags explaining why a v2-only candidate has no v1 placement, derived
// from the authored semantics the v2 eval port cannot express.
// `materializedEndMs` is the end of the last occurrence Core generated:
// v1 occurrence/placement generation is finite (horizon + cap), so v2
// candidates beyond that frontier are period-boundary artifacts, not
// regressions.
function explainV2Only(
  startMs: number,
  sem: CaseSemantics,
  rangeEndMs: number,
  materializedEndMs: number | null,
): ScheduleSemantic[] {
  const tags: ScheduleSemantic[] = [];
  const local = localParts(startMs, sem.offsetMin);
  if (sem.excludedDates.includes(local.date)) tags.push("excluded_dates");
  if (sem.weekdayMask !== null) {
    // bit0=Mon..bit6=Sun (core v1/05); isoWeekday 1=Mon..7=Sun -> bit iso-1
    const bit = 1 << (local.isoWeekday - 1);
    if ((sem.weekdayMask & bit) === 0) tags.push("weekday_mask");
  }
  if (sem.repeatMode === "monthly") {
    const onRuleDay = matchesMonthlyRule(startMs, sem);
    // v2 approximates monthly as a daily step: every candidate NOT on
    // the authored rule day is a v2-input information-loss artifact.
    if (onRuleDay === false) tags.push("monthly_rule");
  }
  // Horizon edge: candidates within one v2 step of the range end, or
  // beyond the last occurrence Core actually generated (materialization
  // cap / horizon truncation), may have no placement for boundary
  // reasons even when the schedule semantics agree.
  const nearRangeEnd =
    sem.v2StepMs !== null && rangeEndMs - startMs <= sem.v2StepMs;
  const beyondMaterialized =
    materializedEndMs !== null && startMs >= materializedEndMs;
  if ((nearRangeEnd || beyondMaterialized) && tags.length === 0) {
    tags.push("period_boundary");
  }
  return tags;
}

// ---------- diff + classification ----------
interface V2Row {
  v2Start: number;
  v2End: number;
  status: "exact" | "start_only" | "v2_only";
  nearest: { deltaMs: number; pStart: number } | null;
  explainedBy: ScheduleSemantic[];
}

type DiffCause =
  | "none"
  | "v2_input_gap"
  | "v1_period_boundary"
  | "suspected_regression"
  | "nondeterminism"
  | "pending";

interface CaseClassification {
  cause: DiffCause;
  semantics: ScheduleSemantic[];
  /** Reserved for Core-side deliberate deviations (issue category ①). */
  intendedSafetyFix: boolean;
  /** True when every divergent row is explained by a known input gap
   *  or a period boundary; false means unexplained divergence remains. */
  fullyExplained: boolean;
  basis: string;
}

function diffCase(
  v2Occurrences: number[][],
  detail: SourceDetail,
  rangeStartMs: number,
  rangeEndMs: number,
  sem: CaseSemantics,
): Record<string, unknown> {
  // The user-facing schedule is the set of PLACEMENTS Core materialized.
  // Occurrence rows are nominal slots (some stay pending/skipped); only
  // placements represent what will actually happen. Compare v2 CANDIDATE
  // [start,end] pairs against placement [start,end] spans — never
  // against occurrences, and never present candidates as placements.
  const placements = detail.placements
    .map((p) => ({
      id: p.placement_id,
      occ: p.occurrence_id,
      start: ms(p.start),
      end: ms(p.end),
      splitIndex: p.split_index,
      splitCount: p.split_count,
      closed: p.closed,
    }))
    .filter(
      (p): p is typeof p & { start: number; end: number } =>
        p.start !== null &&
        p.end !== null &&
        !p.closed &&
        p.start >= rangeStartMs &&
        p.start < rangeEndMs,
    )
    .sort((a, b) => a.start - b.start);
  const placementStartSet = new Set(placements.map((p) => p.start));

  // Generation frontier: the latest instant Core's occurrence generator
  // reached. v2 candidates beyond it cannot have placements regardless
  // of schedule semantics (horizon end or generation cap).
  let materializedEndMs: number | null = null;
  for (const o of detail.occurrences) {
    const end =
      ms(o.window_end) ??
      (ms(o.window_start) !== null
        ? (ms(o.window_start) as number) + (o.required_duration_ms ?? 0)
        : ms(o.nominal_at));
    if (end !== null && (materializedEndMs === null || end > materializedEndMs)) {
      materializedEndMs = end;
    }
  }

  const v2Rows: V2Row[] = v2Occurrences.map(([s, e]) => {
    const exactStart = placementStartSet.has(s);
    // Nearest placement start for diagnostics.
    let nearest: { deltaMs: number; pStart: number } | null = null;
    for (const p of placements) {
      const d = Math.abs(p.start - s);
      if (!nearest || d < nearest.deltaMs) {
        nearest = { deltaMs: d, pStart: p.start };
      }
    }
    const exactSpan = placements.some((p) => p.start === s && p.end === e);
    const status = exactStart
      ? exactSpan
        ? "exact"
        : "start_only"
      : "v2_only";
    return {
      v2Start: s,
      v2End: e,
      status,
      nearest,
      explainedBy:
        status === "v2_only"
          ? explainV2Only(s, sem, rangeEndMs, materializedEndMs)
          : [],
    };
  });

  const v2StartSet = new Set(v2Occurrences.map((o) => o[0]));
  const v1OnlyPlacements = placements.filter((p) => !v2StartSet.has(p.start));

  // Occurrence-level stats (nominal slots, all states) for context.
  const occStarts = detail.occurrences
    .map((o) => ms(o.window_start) ?? ms(o.nominal_at))
    .filter((v): v is number => v !== null && v >= rangeStartMs && v < rangeEndMs);
  const occStateCounts = detail.occurrences.reduce<Record<number, number>>(
    (m, o) => {
      m[o.state] = (m[o.state] ?? 0) + 1;
      return m;
    },
    {},
  );

  const semantics = new Set<ScheduleSemantic>();
  for (const row of v2Rows) {
    for (const tag of row.explainedBy) semantics.add(tag);
  }
  // v1-only placements have no v2-side explanation axis; if any exist
  // they are unexplained divergence (candidate regression) unless they
  // sit at the materialization boundary.
  const boundaryOnlyV1 =
    v1OnlyPlacements.length > 0 &&
    v1OnlyPlacements.every(
      (p) =>
        sem.v2StepMs !== null && rangeEndMs - (p.start as number) <= sem.v2StepMs,
    );
  if (boundaryOnlyV1) semantics.add("period_boundary");

  // start_only rows (same start, different span) are unexplained
  // divergence too: nothing in the semantics model accounts for a span
  // mismatch on an agreed start.
  const unexplainedStartOnly = v2Rows.filter(
    (r) => r.status === "start_only",
  ).length;
  const unexplainedV2Only = v2Rows.filter(
    (r) => r.status === "v2_only" && r.explainedBy.length === 0,
  ).length;
  const unexplainedV1Only = boundaryOnlyV1 ? 0 : v1OnlyPlacements.length;

  const inputGapSemantics = new Set<ScheduleSemantic>([
    "monthly_rule",
    "weekday_mask",
    "excluded_dates",
  ]);
  const hasInputGap = [...semantics].some((s) => inputGapSemantics.has(s));
  const hasBoundary = semantics.has("period_boundary");

  let cause: DiffCause;
  let basis: string;
  if (
    unexplainedV2Only === 0 &&
    unexplainedStartOnly === 0 &&
    unexplainedV1Only === 0
  ) {
    if (
      v2Rows.every((r) => r.status === "exact") &&
      v1OnlyPlacements.length === 0
    ) {
      cause = "none";
      basis = "every v2 candidate matches a v1 placement span exactly";
    } else if (hasInputGap) {
      cause = "v2_input_gap";
      basis = `all divergent rows explained by v2 input gaps: ${[...semantics].join(",")}`;
    } else if (hasBoundary) {
      cause = "v1_period_boundary";
      basis = `divergence confined to the materialization horizon edge: ${[...semantics].join(",")}`;
    } else {
      cause = "none";
      basis = "only boundary-tagged v2-only rows remain";
    }
  } else {
    cause = "suspected_regression";
    basis = `${unexplainedV2Only} unexplained v2-only + ${unexplainedStartOnly} start_only span mismatches + ${unexplainedV1Only} unexplained v1-only placements`;
  }

  return {
    v2Count: v2Occurrences.length,
    v1PlacementCountInRange: placements.length,
    v1OccurrenceCountInRange: occStarts.length,
    v1StateCounts: occStateCounts,
    exactSpan: v2Rows.filter((r) => r.status === "exact").length,
    startOnly: v2Rows.filter((r) => r.status === "start_only").length,
    v2Only: v2Rows.filter((r) => r.status === "v2_only").length,
    unexplainedV2Only,
    v1OnlyPlacementCount: v1OnlyPlacements.length,
    unexplainedV1OnlyPlacementCount: unexplainedV1Only,
    classification: {
      cause,
      semantics: [...semantics],
      intendedSafetyFix: false,
      fullyExplained: unexplainedV2Only === 0 && unexplainedV1Only === 0,
      basis,
    } satisfies CaseClassification,
    v2Rows: v2Rows.slice(0, 60),
    v1OnlyPlacements: v1OnlyPlacements.slice(0, 60).map((p) => ({
      start: p.start,
      end: p.end,
      splitIndex: p.splitIndex,
      splitCount: p.splitCount,
    })),
  };
}

// ---------- run ----------
// v2 occurrences are advisory evaluation candidates, NOT the placements
// Core will materialize. Every summary repeats this so the evidence can
// never be misread as "the v2 preview IS the final schedule".
const CANDIDATE_NOTE =
  "v2 occurrences are advisory opt-in eval candidates, not materialized placements; only the v1 submit -> worker path creates placements";

const results: Record<string, unknown> = {};
for (const c of cases) {
  if (CASE_FILTER && !CASE_FILTER.includes(c.name)) continue;
  log(`=== case ${c.name} ===`);
  const { sub, headers: coreHeaders } = await makeSession(c.name);
  log("  session sub=", sub);
  const now = new Date();
  const state = baseState(now);
  const anchor = new Date(now.getTime() + c.anchorOffsetMs);
  c.apply(state, now, anchor);

  const derivation = deriveV2SchedulerInput(evalStateOf(state, now.getTime()));
  if (!derivation.ok) {
    results[c.name] = { skipped: `underivable: ${derivation.reason}` };
    log("  underivable:", derivation.reason);
    continue;
  }
  const v2Config = v2AdapterConfigFromEnv();
  if (!v2Config) {
    results[c.name] = {
      skipped: "v2 adapter not configured (TASTILE_V2_CLI/STORE/LOCK)",
    };
    log("  v2 adapter not configured");
    continue;
  }
  const v2 = await evaluateSchedulerV2(v2Config, derivation.input);
  if (v2.engine !== "v2" || !v2.ok) {
    results[c.name] = { skipped: `v2 eval failed: ${JSON.stringify(v2)}` };
    log("  v2 eval failed:", JSON.stringify(v2).slice(0, 200));
    continue;
  }
  // Determinism probe (issue category ④): same input through the same
  // lock must reproduce identical candidates. Cheap because the eval is
  // a local subprocess; any drift here is adapter nondeterminism, not a
  // Core materialization difference.
  const v2Repeat = await evaluateSchedulerV2(v2Config, derivation.input);
  const v2Deterministic =
    v2Repeat.engine === "v2" &&
    v2Repeat.ok &&
    JSON.stringify(v2Repeat.occurrences) === JSON.stringify(v2.occurrences);
  const sem = semanticsOf(state, derivation.input.step_ms);
  log(
    `  v2 occurrences=${v2.count} deterministic=${v2Deterministic} range=[${derivation.input.range_start_ms},${derivation.input.range_end_ms}]`,
  );

  // v1 submit through the real publish path.
  const payload = buildQuickCreateSchedulePayload(state, now);
  const title = state.identity.title;
  const body = {
    expected_revision: null,
    idempotency_key: crypto.randomUUID(),
    occurred_at: now.toISOString(),
    payload,
  };
  const res = await fetch(`${CORE}/v1/schedule-definitions`, {
    method: "POST",
    headers: coreHeaders,
    body: JSON.stringify(body),
  });
  const resBody = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!res.ok) {
    results[c.name] = { skipped: `v1 submit ${res.status}: ${JSON.stringify(resBody).slice(0, 300)}` };
    log("  v1 submit failed:", res.status, JSON.stringify(resBody).slice(0, 300));
    continue;
  }
  writeFileSync(
    `${OUT}/${c.name}-submit.json`,
    JSON.stringify({ request: body, response: resBody }, null, 2),
  );

  // Locate the created source tile by title.
  let sourceTileId: string | null = null;
  for (let i = 0; i < 20 && !sourceTileId; i++) {
    const r = await fetch(`${CORE}/v1/source-tiles`, { headers: coreHeaders });
    const list = (await r.json().catch(() => null)) as unknown;
    const items = Array.isArray(list)
      ? list
      : ((list as Record<string, unknown>)?.items ??
        (list as Record<string, unknown>)?.source_tiles ??
        []);
    const hit = (items as Record<string, unknown>[]).find(
      (t) => t.title === title || (t.tile as Record<string, unknown>)?.title === title,
    );
    sourceTileId =
      (hit?.source_tile_id as string) ?? (hit?.id as string) ?? (hit?.tile_id as string) ?? null;
    if (!sourceTileId) await new Promise((r2) => setTimeout(r2, 1000));
  }
  if (!sourceTileId) {
    results[c.name] = { skipped: "source tile not found after submit" };
    log("  source tile not found");
    continue;
  }
  log("  sourceTileId=", sourceTileId);

  // Poll detail until occurrences appear and stabilize, or timeout.
  // "pending" (nothing materialized yet) is reported separately from a
  // real mismatch so async worker lag is not misclassified.
  // Wait until BOTH occurrences and placements stop growing. Placement
  // materialization lags occurrence generation, so an occurrence-stable
  // snapshot can still be mid-flight; pending (state=1) occurrences are
  // not divergences.
  let detail: SourceDetail | null = null;
  let lastSig = "";
  let pollCount = 0;
  let stablePolls = 0;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const r = await fetch(
      `${CORE}/v1/source-tiles/${sourceTileId}?occurrence_limit=1000&placement_limit=1000`,
      { headers: coreHeaders },
    );
    const raw = (await r.json().catch(() => null)) as SourceDetailRaw | null;
    if (raw?.source) {
      const d: SourceDetail = {
        source: raw.source,
        occurrences: listItems(raw.occurrences),
        placements: listItems(raw.placements),
      };
      detail = d;
      const rs = derivation.input.range_start_ms;
      const re = derivation.input.range_end_ms;
      const inRangePlc = d.placements.filter((pl) => {
        const st = ms(pl.start);
        return st !== null && st >= rs && st < re && !pl.closed;
      }).length;
      const placed = d.occurrences.filter((o) => o.state === 0).length;
      // Stable = occurrence count AND in-range placement count unchanged.
      // Placement materialization is chronological and lags occurrence
      // generation, so total placement count is not a reliable signal.
      const sig = `${d.occurrences.length}:${inRangePlc}:${placed}`;
      if (sig === lastSig && d.occurrences.length > 0) {
        stablePolls += 1;
        if (stablePolls >= 5) break; // stable for ~15s
      } else {
        stablePolls = 0;
      }
      lastSig = sig;
      pollCount += 1;
      if (pollCount % 10 === 0) log(`    poll occ=${d.occurrences.length} plc=${d.placements.length} inRange=${inRangePlc} placed=${placed}`);
    }
    await new Promise((r2) => setTimeout(r2, POLL_INTERVAL_MS));
  }
  if (!detail || detail.occurrences.length === 0) {
    results[c.name] = {
      pending: true,
      classification: {
        cause: "pending",
        semantics: [],
        intendedSafetyFix: false,
        fullyExplained: false,
        basis: "no occurrences materialized within timeout; not a mismatch verdict",
      } satisfies CaseClassification,
      note: "no occurrences materialized within timeout; not a mismatch verdict",
      candidateNote: CANDIDATE_NOTE,
      sourceTileId,
      detail,
    };
    log("  PENDING: no occurrences materialized in", POLL_TIMEOUT_MS / 1000, "s");
    continue;
  }
  // The poll snapshot only holds the first page of each §15 envelope;
  // refetch with cursor pagination so the diff sees every row.
  detail = (await fetchDetailFull(sourceTileId, coreHeaders)) ?? detail;
  log(
    `  materialized occurrences=${detail.occurrences.length} placements=${detail.placements.length}`,
  );
  writeFileSync(
    `${OUT}/${c.name}-detail.json`,
    JSON.stringify(detail, null, 2),
  );

  // Read-back: which generation semantics did Core actually persist?
  // A kind/monthly_rule/weekday_mask/excluded_dates mismatch vs the
  // authored state is a Core-side contract regression, independent of
  // the v2 candidate diff.
  const gen = detail.source?.schedule?.generation ?? null;
  const generationReadBack = {
    persisted: gen !== null,
    kind: gen?.kind ?? null,
    expectedKind: sem.expectedGenerationKind,
    kindMatches: gen?.kind === sem.expectedGenerationKind,
    monthlyRule: gen?.monthly_rule ?? null,
    weekdayMask: gen?.weekday_mask ?? null,
    excludedDates: gen?.excluded_dates ?? null,
    dateRangeStart: gen?.date_range_start ?? null,
    dateRangeEnd: gen?.date_range_end ?? null,
    offsetMin: gen?.offset_min ?? null,
  };

  const diff = diffCase(
    v2.occurrences,
    detail,
    derivation.input.range_start_ms,
    derivation.input.range_end_ms,
    sem,
  );
  // Nondeterminism (issue category ④) overrides the diff verdict: if the
  // same v2 input produced different candidates, the diff cannot be
  // attributed to schedule semantics at all.
  const classification =
    !v2Deterministic &&
    (diff.classification as CaseClassification).cause !== "none"
      ? ({
          cause: "nondeterminism",
          semantics: (diff.classification as CaseClassification).semantics,
          intendedSafetyFix: false,
          fullyExplained: false,
          basis:
            "v2 repeat eval produced different occurrences for identical input",
        } satisfies CaseClassification)
      : (diff.classification as CaseClassification);
  // Core dropped authored generation semantics -> contract regression,
  // not a v2 preview artifact.
  const coreRegression =
    generationReadBack.persisted && !generationReadBack.kindMatches;

  results[c.name] = {
    sourceTileId,
    candidateNote: CANDIDATE_NOTE,
    scheduleSemantics: sem,
    v2Deterministic,
    generationReadBack,
    ...(coreRegression
      ? {
          coreRegression: `stored generation.kind=${gen?.kind} but authored repeatMode=${sem.repeatMode} expects kind=${sem.expectedGenerationKind}`,
        }
      : {}),
    v2Input: derivation.input,
    ...diff,
    classification,
  };
  log(
    `  diff: exact=${diff.exactSpan} startOnly=${diff.startOnly} v2Only=${diff.v2Only} v1OnlyPlc=${diff.v1OnlyPlacementCount} cause=${classification.cause} semantics=${classification.semantics.join("+") || "-"}`,
  );
}

writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify(
    {
      _contract: "tastile-openapi v3.5.0 (submodule 8a61003); Core release-1-1-0 @ d148241d",
      _candidateNote: CANDIDATE_NOTE,
      _classification:
        "cause: none | v2_input_gap (v2 port cannot express authored semantics) | v1_period_boundary | suspected_regression | nondeterminism | pending; semantics: monthly_rule | weekday_mask | excluded_dates | period_boundary",
      cases: results,
    },
    null,
    2,
  ),
);
log("wrote", `${OUT}/summary.json`);
