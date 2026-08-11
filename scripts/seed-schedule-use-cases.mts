#!/usr/bin/env bun
// scripts/seed-schedule-use-cases.mts
//
// SCHEDULE.md §25 の実現確認用ユースケースを正規の POST /v1/source-tiles で
// 1 件ずつ投げるスクリプト。SQL 直書きなし、初期化時自動実行なし。
// Bridge 認証 (TASTILE_WEB_BRIDGE_SECRET + x-tastile-web-session-user) を使用。
//
// idempotencyKey は UUIDv7 の fresh-random を使う(POST /v1/source-tiles の正規
// envelope と同じ。canonical source-tiles.ts の `commandEnvelope` を参照)。
// 再実行時は source tile が二重作成されるので、clean DB での seed 専用スクリプト。
// 冪等性が要る運用は `teardown-schedule-use-cases` か `DELETE` で対応。
//
// 使い方:
//   bun run scripts/seed-schedule-use-cases.mts
//   bun run scripts/seed-schedule-use-cases.mts --user-sub=dev-bypass --base-url=http://127.0.0.1:31400
//
// 必要な環境変数 (.env.local / .env.development のどちらかから自動読み込み):
//   TASTILE_WEB_BRIDGE_SECRET  (E2E_BYPASS_AUTH=1 のときは不要)
//
// CLI オーバーライド:
//   --user-sub=<sub>     bridge の session user sub (default: dev-bypass)
//   --base-url=<url>     daemon URL (default: http://127.0.0.1:31400)
//   --horizon-days=<n>   placement horizon (default: 14)
//   --section=<id>       1 つの section だけ実行 (例: "25.1")

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------- env

function readEnvFile(filename: string): Record<string, string> {
  const path = resolve(ROOT, filename);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // strip inline comment after whitespace
    const hashIdx = value.search(/\s#/);
    if (hashIdx >= 0) value = value.slice(0, hashIdx).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const envLocal = readEnvFile(".env.local");
const envDev = readEnvFile(".env.development");

function env(key: string): string | undefined {
  return process.env[key] ?? envLocal[key] ?? envDev[key];
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq < 0) {
      out[arg.slice(2)] = "true";
    } else {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const BASE_URL =
  args["base-url"] ??
  env("TASTILE_DAEMON_URL") ??
  env("TASTILE_RUST_API_URL") ??
  env("CLOUD_API_BASE") ??
  "http://127.0.0.1:31400";

const BRIDGE_SECRET = env("TASTILE_WEB_BRIDGE_SECRET");
const SESSION_USER = args["user-sub"] ?? env("TASTILE_WEB_SESSION_USER") ?? "dev-bypass";
const HORIZON_DAYS = Number(args["horizon-days"] ?? "14");
const ONLY_SECTION = args["section"];

// E2E_BYPASS_AUTH=1 mode (the canonical dev bypass on tastile-web) sends
// `x-owner-id` instead of bridge secret + session user. Match the upstream
// `isE2EBypass()` so seeds land in the same owner as the dashboard renders.
const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";
const IS_E2E_BYPASS = env("E2E_BYPASS_AUTH") === "1";

if (!BRIDGE_SECRET && !IS_E2E_BYPASS) {
  console.error(
    "TASTILE_WEB_BRIDGE_SECRET is unset and E2E_BYPASS_AUTH!=1. Set one of them in .env.local or .env.development.",
  );
  process.exit(2);
}

// ---------------------------------------------------------------- uuidv7 (RFC 9562, monotonic)

// 12-bit monotonic counter reseeded from crypto on every new millisecond.
// Identical layout to src/tile/model/v1/envelope.ts `uuidv7()`.
let _lastTs = -1;
let _counter = 0;
function byteAt(buf: Uint8Array, index: number): number {
  return buf[index] ?? 0;
}

function uuidv7(): string {
  const tsMs = Date.now();
  if (tsMs === _lastTs) {
    _counter = (_counter + 1) & 0x0fff;
  } else {
    _lastTs = tsMs;
    const seed = new Uint8Array(2);
    crypto.getRandomValues(seed);
    _counter = ((byteAt(seed, 0) << 4) | (byteAt(seed, 1) >>> 4)) & 0x0fff;
  }
  const rand = new Uint8Array(8);
  crypto.getRandomValues(rand);
  const tsHex = tsMs.toString(16).padStart(12, "0");
  const byte6 = 0x70 | ((_counter >>> 8) & 0x0f);
  const byte7 = _counter & 0xff;
  const byte8 = 0x80 | (byteAt(rand, 0) & 0x3f);
  const bytes = new Uint8Array([
    byte6, byte7, byte8,
    byteAt(rand, 1), byteAt(rand, 2), byteAt(rand, 3),
    byteAt(rand, 4), byteAt(rand, 5), byteAt(rand, 6), byteAt(rand, 7),
  ]);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 20)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------- constants

const WEEKDAYS = {
  DAILY: 0b1111111,   // 127 月火水木金土日
  WEEKDAY: 0b0111111, // 63  月火水木金 (bit 6=Sun を除外)
  MON: 0b0000001,
  TUE: 0b0000010,
  WED: 0b0000100,
  THU: 0b0001000,
  FRI: 0b0010000,
  SAT: 0b0100000,
  SUN: 0b1000000,
} as const;

const JST_OFFSET_MIN = 540;
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- time helpers

// JST(hour:minute) を ISO UTC instant に変換。
// scheduler.first_overlapping_sequence は `nominal_at = starts_at + (1 + floor(threshold/interval)) * interval` で計算するため、
// starts_at を「JST 昨日の同時刻」に置く → sequence=1 で「JST 今日」に最初の occurrence が落ちる。
// ダッシュボードのクエリ範囲は JST 00:00–24:00 of today で、horizon.start = today_utc_midnight を併送する。
function jstHourToPreviousDayUtcIso(jstHour: number, jstMinute: number): string {
  const now = new Date();
  // JST now → JST の Y/M/D
  const jstNow = new Date(now.getTime() + JST_OFFSET_MIN * 60_000);
  const y = jstNow.getUTCFullYear();
  const mo = jstNow.getUTCMonth();
  const d = jstNow.getUTCDate();
  // 昨日 JST の同時刻を UTC で表現
  const jstYesterday = new Date(Date.UTC(y, mo, d) - DAY_MS);
  const yy = jstYesterday.getUTCFullYear();
  const ymo = jstYesterday.getUTCMonth();
  const yd = jstYesterday.getUTCDate();
  const utcMs = Date.UTC(yy, ymo, yd, jstHour - 9, jstMinute, 0);
  return new Date(utcMs).toISOString();
}

function todayUtcMidnightIso(): { start: string; end: string } {
  const now = new Date();
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // horizon.start = JST 00:00 of today (= today UTC midnight - 9h).
  // This matches the dashboard's `/api/events/occurrences` window anchor.
  const start = new Date(utcMidnight.getTime() - JST_OFFSET_MIN * 60_000);
  const end = new Date(start.getTime() + HORIZON_DAYS * DAY_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ---------------------------------------------------------------- payload builder

interface TileSpec {
  title: string;
  description: string;
  weekdayMask: number;
  jstHour: number;
  jstMinute: number;
  durationMs: number;
  windowPaddingStartMs?: number;
  windowPaddingEndMs?: number;
}

function recurringTile(spec: TileSpec) {
  // uuidv7 (fresh-random) + occurred_at = nowIso() matches the canonical
  // `commandEnvelope()` from src/shared/api/v1/source-tiles.ts:511. Earlier
  // second-resolution uuidv5 keys collided across runs (409 "idempotency_key
  // reused with different payload") because the inner spec-derived idem was
  // constant and any second-aligned namespace still hashed against the spec.
  const startsAt = jstHourToPreviousDayUtcIso(spec.jstHour, spec.jstMinute);
  const horizon = todayUtcMidnightIso();
  return {
    expected_revision: null,
    idempotency_key: uuidv7(),
    occurred_at: nowIso(),
    payload: {
      tile: {
        title: spec.title,
        description: spec.description,
        color: null,
        icon: null,
        external_id: null,
      },
      plan: {
        role: 0,
        references: [],
        completion: { root: { All: [] }, time_requirements: [], tasks: [] },
        planning: { placement_rules: [], nesting_rules: [] },
        metrics: [],
        decisions: [],
      },
      flows: [],
      schedule: {
        required_duration_ms: spec.durationMs,
        generation: {
          kind: 1,
          at: null,
          starts_at: startsAt,
          interval_ms: DAY_MS,
          ends_at: null,
          weekday_mask: spec.weekdayMask,
          date_range_start: null,
          date_range_end: null,
          excluded_dates: [],
          offset_min: JST_OFFSET_MIN,
        },
        window: {
          start_offset_ms: spec.windowPaddingStartMs ?? 0,
          end_offset_ms: spec.durationMs + (spec.windowPaddingEndMs ?? 0),
        },
        split_policy: {
          kind: 0,
          min_segment_ms: null,
          max_segment_ms: null,
          max_segments: null,
        },
        priority: 0,
      },
      horizon: { start: horizon.start, end: horizon.end },
    },
  };
}

// ---------------------------------------------------------------- §25 use cases

interface UseCase {
  section: string;
  requests: Awaited<ReturnType<typeof recurringTile>>[];
}

const USE_CASES: UseCase[] = [
  {
    section: "25.1 通常の月曜日",
    requests: [
      // 01:00-07:30 睡眠 (6h30m)
      recurringTile({
        title: "睡眠",
        description: "日次 01:00-07:30 (SCHEDULE.md §4.1)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 1,
        jstMinute: 0,
        durationMs: 6.5 * 60 * 60 * 1000,
      }),
      // 07:30-07:31 朝点呼 (1分, 起床直後)
      recurringTile({
        title: "朝点呼",
        description: "起床後空き1分 07:30-08:39 (SCHEDULE.md §5.2)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 7,
        jstMinute: 30,
        durationMs: 60 * 1000,
      }),
      // 07:40-07:55 朝食 (15分)
      recurringTile({
        title: "朝食",
        description: "07:40-08:00 15分 (SCHEDULE.md §6)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 7,
        jstMinute: 40,
        durationMs: 15 * 60 * 1000,
      }),
      // 08:50-10:20 法学A (月曜)
      recurringTile({
        title: "法学A",
        description: "月曜 08:50-10:20 (SCHEDULE.md §15.1)",
        weekdayMask: WEEKDAYS.MON,
        jstHour: 8,
        jstMinute: 50,
        durationMs: 90 * 60 * 1000,
      }),
      // 10:30-12:00 英語IV A (月曜)
      recurringTile({
        title: "英語IV A",
        description: "月曜 10:30-12:00 (SCHEDULE.md §15.1)",
        weekdayMask: WEEKDAYS.MON,
        jstHour: 10,
        jstMinute: 30,
        durationMs: 90 * 60 * 1000,
      }),
      // 12:50-14:20 計測工学 (月曜)
      recurringTile({
        title: "計測工学",
        description: "月曜 12:50-14:20 (SCHEDULE.md §15.1)",
        weekdayMask: WEEKDAYS.MON,
        jstHour: 12,
        jstMinute: 50,
        durationMs: 90 * 60 * 1000,
      }),
      // 12:20-12:40 昼食 (推奨 12:20, 20分)
      recurringTile({
        title: "昼食",
        description: "11:40-12:40 推奨12:20 20分 (SCHEDULE.md §7)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 12,
        jstMinute: 20,
        durationMs: 20 * 60 * 1000,
      }),
      // 18:00-18:20 夕食 (推奨 18:00, 17:40-19:40 窓)
      recurringTile({
        title: "夕食",
        description: "17:40-19:40 推奨18:00 20分 (SCHEDULE.md §8)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 18,
        jstMinute: 0,
        durationMs: 20 * 60 * 1000,
        windowPaddingStartMs: -20 * 60 * 1000,
        windowPaddingEndMs: 100 * 60 * 1000,
      }),
      // 19:00-19:20 入浴 (夕食後 20:55 までに完了)
      recurringTile({
        title: "入浴",
        description: "17:00-20:55 推奨夕食後 20分 (SCHEDULE.md §9)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 19,
        jstMinute: 0,
        durationMs: 20 * 60 * 1000,
      }),
      // 20:55-21:00 準備
      recurringTile({
        title: "準備",
        description: "20:55-21:00 いど端底力タイム準備 (SCHEDULE.md §10.3)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 20,
        jstMinute: 55,
        durationMs: 5 * 60 * 1000,
      }),
      // 21:00-22:40 いど端底力タイム (平日)
      recurringTile({
        title: "いど端底力タイム",
        description: "21:00-22:40 平日 (SCHEDULE.md §10)",
        weekdayMask: WEEKDAYS.WEEKDAY,
        jstHour: 21,
        jstMinute: 0,
        durationMs: 100 * 60 * 1000,
      }),
      // 22:40-22:50 振り返り (10分)
      recurringTile({
        title: "振り返り",
        description: "22:40-22:50 (SCHEDULE.md §10.6)",
        weekdayMask: WEEKDAYS.WEEKDAY,
        jstHour: 22,
        jstMinute: 40,
        durationMs: 10 * 60 * 1000,
      }),
      // 23:00-23:01 消灯
      recurringTile({
        title: "消灯",
        description: "23:00 1分 (SCHEDULE.md §12)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 23,
        jstMinute: 0,
        durationMs: 60 * 1000,
      }),
      // 23:05-23:20 Duolingo (15分)
      recurringTile({
        title: "Duolingo",
        description: "15分 24:00まで (SCHEDULE.md §13.2)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 23,
        jstMinute: 5,
        durationMs: 15 * 60 * 1000,
      }),
      // 23:20-23:35 モチタン (15分, Duolingo の後)
      recurringTile({
        title: "モチタン",
        description: "15分 Duolingo後 (SCHEDULE.md §13.3)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 23,
        jstMinute: 20,
        durationMs: 15 * 60 * 1000,
      }),
      // 23:35-23:45 LinkedIn Games (10分, モチタンの後)
      recurringTile({
        title: "LinkedIn Games",
        description: "10分 モチタン後 (SCHEDULE.md §13.4)",
        weekdayMask: WEEKDAYS.DAILY,
        jstHour: 23,
        jstMinute: 35,
        durationMs: 10 * 60 * 1000,
      }),
    ],
  },
  {
    section: "25.2 通常の金曜日",
    requests: [
      recurringTile({
        title: "中国語A",
        description: "金曜 10:30-12:00 (SCHEDULE.md §15.5)",
        weekdayMask: WEEKDAYS.FRI,
        jstHour: 10,
        jstMinute: 30,
        durationMs: 90 * 60 * 1000,
      }),
      recurringTile({
        title: "PJ学習III(午後1)",
        description: "金曜 12:50-14:20 (SCHEDULE.md §15.5)",
        weekdayMask: WEEKDAYS.FRI,
        jstHour: 12,
        jstMinute: 50,
        durationMs: 90 * 60 * 1000,
      }),
      recurringTile({
        title: "PJ学習III(午後2)",
        description: "金曜 14:40-16:10 (SCHEDULE.md §15.5)",
        weekdayMask: WEEKDAYS.FRI,
        jstHour: 14,
        jstMinute: 40,
        durationMs: 90 * 60 * 1000,
      }),
    ],
  },
  {
    // §25.3 入浴を夕食後に配置できない日: scheduler engine が runtime で処理。
    // 新規 source tile は不要。
    section: "25.3 入浴 edge case",
    requests: [],
  },
  {
    // §25.4 夜の日次タスクが収まらない日: scheduler engine が runtime で処理。
    section: "25.4 夜タスク溢れ",
    requests: [],
  },
  {
    // §25.5 自動徹夜: 期限タスクの scheduler 判定。user input 起点ではない。
    section: "25.5 自動徹夜",
    requests: [],
  },
  {
    // §25.6 徹夜(授業前から): user input trigger。
    section: "25.6 徹夜(授業前から)",
    requests: [],
  },
  {
    // §25.7 徹夜(夕食後): user input trigger。
    section: "25.7 徹夜(夕食後)",
    requests: [],
  },
  {
    // §25.8 徹夜(早く終わった): runtime state transition。
    section: "25.8 徹夜(早く終わった)",
    requests: [],
  },
  {
    // §25.9 洗濯終了時固定予定: 洗濯 workflow 自体の source-tile 化は別 plan。
    section: "25.9 洗濯終了時固定予定",
    requests: [],
  },
  {
    section: "25.10 土曜日",
    requests: [
      // 土曜の いど端底力タイム は AtCoder ABC で埋まる (§22.1)。
      // 月-金とは別の source tile として分離 (weekday_mask = SAT のみ)。
      recurringTile({
        title: "いど端底力タイム(土曜 AtCoder)",
        description: "土曜 21:00-22:40 AtCoder (§22.1)",
        weekdayMask: WEEKDAYS.SAT,
        jstHour: 21,
        jstMinute: 0,
        durationMs: 100 * 60 * 1000,
      }),
    ],
  },
  {
    // §25.11 夏季休暇: 通常時寮生活ルーティーンを生成しない期間。
    // Recurring life state で制御。新規 tile は出さない。
    section: "25.11 夏季休暇",
    requests: [],
  },
];

// ---------------------------------------------------------------- run

async function main() {
  console.log(`[info] BASE_URL = ${BASE_URL}`);
  console.log(`[info] SESSION_USER = ${SESSION_USER}`);
  console.log(`[info] HORIZON_DAYS = ${HORIZON_DAYS}`);
  if (ONLY_SECTION) console.log(`[info] ONLY_SECTION = ${ONLY_SECTION}`);

  // 1. daemon health
  const healthRes = await fetch(`${BASE_URL}/v1/health`);
  if (!healthRes.ok) {
    console.error(`[fatal] daemon /v1/health returned ${healthRes.status}`);
    process.exit(3);
  }
  console.log(`[ok] daemon /v1/health 200\n`);

  let total = 0;
  let applied = 0;
  let alreadyApplied = 0;
  let accepted = 0;
  let failed = 0;

  outer: for (const uc of USE_CASES) {
    if (ONLY_SECTION && !uc.section.includes(ONLY_SECTION)) continue;
    if (uc.requests.length === 0) {
      console.log(`[skip] ${uc.section}`);
      continue outer;
    }
    console.log(`=== ${uc.section} ===`);
    for (const req of uc.requests) {
      const title = req.payload.tile.title;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (IS_E2E_BYPASS) {
        headers["x-owner-id"] = DEV_ACTOR_SUBJECT_ID;
        headers["x-actor-id"] = DEV_ACTOR_SUBJECT_ID;
      } else {
        headers["x-tastile-web-bridge-secret"] = BRIDGE_SECRET!;
        headers["x-tastile-web-session-user"] = SESSION_USER;
      }
      const res = await fetch(`${BASE_URL}/v1/source-tiles`, {
        method: "POST",
        headers,
        body: JSON.stringify(req),
      });
      total++;
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // ignore parse error, fall through to error path
      }
      // CommandResult: 0 = APPLIED, 1 = ALREADY_APPLIED, 2 = ACCEPTED (queued for worker)
      if (res.ok && body?.result === 0) {
        applied++;
        console.log(`  APPLIED          ${res.status}  ${title}`);
      } else if (res.ok && body?.result === 1) {
        alreadyApplied++;
        console.log(`  ALREADY_APPLIED  ${res.status}  ${title}`);
      } else if (res.ok && body?.result === 2) {
        accepted++;
        console.log(`  ACCEPTED (queued) ${res.status}  ${title}`);
      } else if (res.ok) {
        console.log(
          `  UNEXPECTED       ${res.status}  ${title}  result=${body?.result}`,
        );
        failed++;
      } else {
        failed++;
        console.log(
          `  FAILED           ${res.status}  ${title}  ${JSON.stringify(body)}`,
        );
      }
    }
  }

  console.log(
    `\n[summary] total=${total} applied=${applied} already_applied=${alreadyApplied} accepted=${accepted} failed=${failed}`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`[fatal] ${e instanceof Error ? e.stack ?? e.message : e}`);
  process.exit(1);
});
