#!/usr/bin/env bun
/**
 * web#219 item E — v2 scheduler candidate vs Core v1 materialization diff.
 *
 * For each synthetic schedule case this script:
 *   1. derives the v2 SchedulerEvalInput exactly like V2ScheduleEval does,
 *   2. runs the real tastile-v2 binary through evaluateSchedulerV2,
 *   3. submits the SAME QuickCreate state through the real v1 path
 *      (buildQuickCreateSchedulePayload -> POST /v1/schedule-definitions),
 *   4. polls GET /v1/source-tiles/{id} until occurrences/placements
 *      materialize (async worker) or a timeout distinguishes "pending"
 *      from "mismatch",
 *   5. compares occurrence start instants and, for matched occurrences,
 *      placement spans vs the v2 candidate [start,end] pairs.
 *
 * All times are absolute UTC instants; offset_min is only used for display.
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
interface SourceDetail {
  source: { source_tile_id: string };
  occurrences: V1Occurrence[];
  placements: V1Placement[];
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const v = Date.parse(iso);
  return Number.isFinite(v) ? v : null;
}

function diffCase(
  v2Occurrences: number[][],
  detail: SourceDetail,
  rangeStartMs: number,
  rangeEndMs: number,
): Record<string, unknown> {
  // The user-facing schedule is the set of PLACEMENTS Core materialized.
  // Occurrence rows are nominal slots (some stay pending/skipped); only
  // placements represent what will actually happen. Compare v2 candidate
  // [start,end] pairs against placement [start,end] spans.
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

  const v2Rows = v2Occurrences.map(([s, e]) => {
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
    return {
      v2Start: s,
      v2End: e,
      status: exactStart ? (exactSpan ? "exact" : "start_only") : "v2_only",
      nearest,
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

  return {
    v2Count: v2Occurrences.length,
    v1PlacementCountInRange: placements.length,
    v1OccurrenceCountInRange: occStarts.length,
    v1StateCounts: occStateCounts,
    exactSpan: v2Rows.filter((r) => r.status === "exact").length,
    startOnly: v2Rows.filter((r) => r.status === "start_only").length,
    v2Only: v2Rows.filter((r) => r.status === "v2_only").length,
    v1OnlyPlacementCount: v1OnlyPlacements.length,
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
  const v2 = await evaluateSchedulerV2(
    v2AdapterConfigFromEnv(),
    derivation.input,
  );
  if (!v2.ok || v2.engine !== "v2") {
    results[c.name] = { skipped: `v2 eval failed: ${JSON.stringify(v2)}` };
    log("  v2 eval failed:", JSON.stringify(v2).slice(0, 200));
    continue;
  }
  log(`  v2 occurrences=${v2.count} range=[${derivation.input.range_start_ms},${derivation.input.range_end_ms}]`);

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
    const r = await fetch(`${CORE}/v1/source-tiles/${sourceTileId}`, {
      headers: coreHeaders,
    });
    const d = (await r.json().catch(() => null)) as SourceDetail | null;
    if (d && Array.isArray(d.occurrences)) {
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
      note: "no occurrences materialized within timeout; not a mismatch verdict",
      sourceTileId,
      detail,
    };
    log("  PENDING: no occurrences materialized in", POLL_TIMEOUT_MS / 1000, "s");
    continue;
  }
  log(
    `  materialized occurrences=${detail.occurrences.length} placements=${detail.placements.length}`,
  );
  writeFileSync(
    `${OUT}/${c.name}-detail.json`,
    JSON.stringify(detail, null, 2),
  );

  const diff = diffCase(
    v2.occurrences,
    detail,
    derivation.input.range_start_ms,
    derivation.input.range_end_ms,
  );
  results[c.name] = {
    sourceTileId,
    v2Input: derivation.input,
    ...diff,
  };
  log(
    `  diff: exact=${diff.exactSpan} startOnly=${diff.startOnly} v2Only=${diff.v2Only} v1OnlyPlc=${diff.v1OnlyPlacementCount} (v2=${diff.v2Count} v1plc=${diff.v1PlacementCountInRange})`,
  );
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
log("wrote", `${OUT}/summary.json`);
