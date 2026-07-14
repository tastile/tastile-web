//! Upstream bridge: when TASTILE_USE_RUST_CORE=1, the Next.js
//! calendar routes forward requests to the v1 Rust API running on
//! http://127.0.0.1:31400.  Calendar data flows through v1 tiles,
//! v1 placements, and /v1/timeline; the v0 /v1/events CRUD surface
//! has been removed.  This module owns URL construction, the
//! snake_case <-> camelCase field conversion, the v1 command envelope
//! wrapping, and HTTP error mapping.

import { cookies } from "next/headers";
import { v5 as uuidv5 } from "uuid";
import { resolveAuthenticatedUserSub } from "@/lib/cognito/authenticated-session";

const RUST_BASE = process.env.TASTILE_RUST_API_URL ?? "http://127.0.0.1:31400";
const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";
// Resolved at call time so tests mutating process.env after module load still see the bypass branch.
function isE2EBypass(): boolean {
  return process.env.E2E_BYPASS_AUTH === "1";
}

type AnyObj = Record<string, unknown>;

function snakeKeyToCamelKey(k: string): string {
  return k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camelKeyToSnakeKey(k: string): string {
  return k.replace(/[A-Z]/g, (_, c) => `_${c.toLowerCase()}`);
}

function transform(obj: unknown, keyMap: (k: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map((v) => transform(v, keyMap));
  if (obj && typeof obj === "object") {
    const out: AnyObj = {};
    for (const [k, v] of Object.entries(obj as AnyObj)) {
      out[keyMap(k)] = transform(v, keyMap);
    }
    return out;
  }
  return obj;
}

function toCamel<T = unknown>(obj: unknown): T {
  return transform(obj, snakeKeyToCamelKey) as T;
}

function toSnake<T = unknown>(obj: unknown): T {
  return transform(obj, camelKeyToSnakeKey) as T;
}

async function readJsonOrText(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function upstreamError(status: number, body: unknown): Response {
  const detail =
    (body as { error?: string; message?: string } | null)?.error ??
    (body as { error?: string; message?: string } | null)?.message;
  const message = detail ?? `Upstream returned ${status}`;
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// v1 CommandEnvelope helpers ------------------------------------------------
//
// Per v1/14 §1 every Command body MUST be wrapped in
// `{ expected_revision, idempotency_key, occurred_at, payload }`.  All
// write paths (POST /v1/tiles, POST /v1/tiles/{id}/update, ...)
// reject requests without `idempotency_key`.  The helpers below emit
// UUIDv7 idempotency keys per call so retries are idempotent.

function nowIso(): string {
  return new Date().toISOString();
}

function uuidv7(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return uuidv5(
    String(Date.now()) + Math.random().toString(36),
    "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  );
}

function envelope<T>(payload: T): Record<string, unknown> {
  return {
    expected_revision: null,
    idempotency_key: uuidv7(),
    occurred_at: nowIso(),
    payload,
  };
}

async function bridgeHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string> | null> {
  if (isE2EBypass()) {
    return {
      ...(extra ?? {}),
      "x-owner-id": DEV_ACTOR_SUBJECT_ID,
      "x-actor-id": DEV_ACTOR_SUBJECT_ID,
    };
  }

  const cookieStore = await cookies();
  const userSub = await resolveAuthenticatedUserSub({ cookieStore });
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!userSub || !bridgeSecret) return null;

  return {
    ...(extra ?? {}),
    "x-tastile-web-bridge-secret": bridgeSecret,
    "x-tastile-web-session-user": userSub,
  };
}

function unauthenticatedUpstreamResponse(): Response {
  return upstreamError(401, { error: "Unauthorized" });
}

const TIMELINE_ITEM_TO_EVENT: Array<{ hex: string; name: string }> = [
  { hex: "#3b82f6", name: "blue" },
  { hex: "#22c55e", name: "green" },
  { hex: "#a855f7", name: "purple" },
  { hex: "#f97316", name: "orange" },
  { hex: "#ec4899", name: "pink" },
  { hex: "#06b6d4", name: "cyan" },
  { hex: "#eab308", name: "yellow" },
  { hex: "#ef4444", name: "red" },
  { hex: "#14b8a6", name: "teal" },
  { hex: "#6366f1", name: "indigo" },
  { hex: "#84cc16", name: "lime" },
  { hex: "#6b7280", name: "gray" },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}

function mapTimelineColor(hex: string | null | undefined): string {
  if (!hex) return "blue";
  const c = hexToRgb(hex);
  if (!c) return "blue";
  let best = TIMELINE_ITEM_TO_EVENT[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const cand of TIMELINE_ITEM_TO_EVENT) {
    const cr = hexToRgb(cand.hex);
    if (!cr) continue;
    const dr = c.r - cr.r;
    const dg = c.g - cr.g;
    const db = c.b - cr.b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }
  return best.name;
}

function toUtcIso(value: string): string {
  if (!value) return value;
  if (/[zZ]$|[+-]d{2}:?d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

export interface TimelineQuery {
  start: string;
  end: string;
  minMinutes?: number;
  includeRecurring?: boolean;
  ownerIds?: string[];
}

interface TimelineItemRaw {
  placement_id?: string;
  revision?: number;
  /** Tile id for the placement source. */
  tile_id?: string;
  content?: { title?: string; description?: string | null };
  visual?: { color?: string | null; icon?: string | null };
  role?: number;
  span?: { start?: string; end?: string };
  inside?: unknown;
  source?: { kind?: number; detail?: string };
  resolution?: { state?: number };
}

/**
 * GET /v1/timeline -- capability-aware read over v1 placements,
 * lazily expanded from active recurring tiles frame rules.
 */
export async function upstreamListTimeline(q: TimelineQuery): Promise<Response> {
  const qs = new URLSearchParams();
  qs.set("start", toUtcIso(q.start));
  qs.set("end", toUtcIso(q.end));
  qs.set("include_labels", "true");
  if (q.ownerIds?.length) qs.set("owner_ids", q.ownerIds.join(","));
  const headers = await bridgeHeaders();
  if (!headers) return unauthenticatedUpstreamResponse();
  const url = `${RUST_BASE}/v1/timeline?${qs.toString()}`;
  const res = await fetch(url, { cache: "no-store", headers });
  if (!res.ok) return upstreamError(res.status, await readJsonOrText(res));
  const items = (await readJsonOrText(res)) as TimelineItemRaw[] | null;
  const nowIso = new Date().toISOString();
  const minMinutes = q.minMinutes ?? 0;
  const events: unknown[] = [];
  for (const raw of items ?? []) {
    const span = raw.span ?? {};
    const start = toUtcIso(span.start ?? "");
    const end = toUtcIso(span.end ?? "");
    if (!start || !end) continue;
    if (minMinutes > 0) {
      const durMin = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
      if (durMin < minMinutes) continue;
    }
    events.push({
      id: raw.placement_id ?? "",
      tileId: raw.tile_id ?? null,
      title: raw.content?.title ?? "",
      description: raw.content?.description ?? null,
      location: null,
      start,
      end,
      // A LABEL can be a timed, non-blocking annotation (such as a
      // Pomodoro break) or date-wide calendar context.  Only the latter
      // belongs in the all-day lane.
      allDay:
        raw.role === 1 &&
        new Date(end).getTime() - new Date(start).getTime() >= 23 * 60 * 60 * 1000,
      color: mapTimelineColor(raw.visual?.color),
      recurrence: { frequency: "none" },
      attendees: [],
      icon: raw.visual?.icon ?? null,
      project: null,
      tags: [],
      memo: null,
      source:
        raw.source?.kind != null
          ? { kind: raw.source.kind, detail: raw.source.detail ?? null }
          : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return new Response(JSON.stringify({ occurrences: events }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export interface CalendarCreateInput {
  title: string;
  description?: string | null;
  start: string;
  end: string;
  color?: string | null;
  icon?: string | null;
}

export interface CalendarEventResult {
  id: string;
  tileId: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  icon: string | null;
  location: string | null;
  recurrence: { frequency: string };
  attendees: unknown[];
  project: unknown;
  tags: unknown[];
  memo: unknown;
  source: { kind: number; detail: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Compose a calendar create call into the v1 tile + Manual-placement
 * pair.  Returns the { event } shape the rest of the web layer expects.
 *
 * The v1 wire envelope wraps both commands (POST /v1/tiles and
 * POST /v1/placements) so each request carries a fresh
 * idempotency_key, expected_revision=null, and a typed payload.
 */
export async function upstreamCreateCalendarEvent(input: CalendarCreateInput): Promise<Response> {
  const headers = await bridgeHeaders({ "content-type": "application/json" });
  if (!headers) return unauthenticatedUpstreamResponse();

  // 1) POST /v1/tiles (kind=1 = PLACEMENT).  Server creates the tile
  //    and an auto-created Plan row in one transaction; aggregate_meta
  //    carries both ids back so we do not need a GET-after-POST.
  const tileRes = await fetch(`${RUST_BASE}/v1/tiles`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      envelope({
        kind: 1, // TileKind::PLACEMENT
        title: input.title,
        description: input.description ?? null,
        color: input.color ?? "#3b82f6",
        icon: input.icon ?? "check-circle",
        external_id: null,
        plan_role: 0, // PlanRole::EXECUTABLE
      }),
    ),
  });
  if (!tileRes.ok) return upstreamError(tileRes.status, await readJsonOrText(tileRes));
  const tileBody = (await readJsonOrText(tileRes)) as Record<string, unknown> | null;
  const tileId = String((tileBody?.aggregate as { id?: string } | undefined)?.id ?? "");
  const planId = String(
    (tileBody?.aggregate_meta as { plan_id?: string } | undefined)?.plan_id ?? "",
  );
  if (!tileId) {
    return upstreamError(500, { error: "create tile returned no id" });
  }

  // 2) POST /v1/placements (CREATE_PLACEMENT) with source=MANUAL (3).
  //    The PlacementBaseline carries the time span the calendar event
  //    occupies.
  const placementRes = await fetch(`${RUST_BASE}/v1/placements`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      envelope({
        tile_id: tileId,
        plan_id: planId,
        source: 3, // PlacementSource::MANUAL
        source_ref: {
          created: null,
          recurring: null,
          flow: null,
          frame: null,
          proposal: null,
          source_text: null,
          external_id: null,
        },
        baseline: {
          span: {
            start: toUtcIso(input.start),
            end: toUtcIso(input.end),
          },
          inside: null,
        },
      }),
    ),
  });
  if (!placementRes.ok) {
    return upstreamError(placementRes.status, await readJsonOrText(placementRes));
  }
  const placementBody = (await readJsonOrText(placementRes)) as Record<string, unknown> | null;
  const placementId = String((placementBody?.aggregate as { id?: string } | undefined)?.id ?? "");
  const nowIso = new Date().toISOString();
  const event: CalendarEventResult = {
    id: placementId,
    tileId,
    title: input.title,
    description: input.description ?? null,
    start: toUtcIso(input.start),
    end: toUtcIso(input.end),
    allDay: false,
    color: input.color ?? "blue",
    icon: input.icon ?? null,
    location: null,
    recurrence: { frequency: "none" },
    attendees: [],
    project: null,
    tags: [],
    memo: null,
    source: { kind: 0, detail: null },
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return new Response(JSON.stringify({ event: toCamel(event) }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}

/** Update v1 tile fields (POST /v1/tiles/{id}/update). */
export async function upstreamUpdateTile(
  tileId: string,
  patch: {
    title?: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
  },
): Promise<Response> {
  const headers = await bridgeHeaders({ "content-type": "application/json" });
  if (!headers) return unauthenticatedUpstreamResponse();
  const res = await fetch(`${RUST_BASE}/v1/tiles/${encodeURIComponent(tileId)}/update`, {
    method: "POST",
    headers,
    body: JSON.stringify(envelope(toSnake({ tile_id: tileId, ...patch }))),
  });
  if (!res.ok) return upstreamError(res.status, await readJsonOrText(res));
  const tile = await readJsonOrText(res);
  return new Response(JSON.stringify({ tile: toCamel(tile) }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Archive v1 tile (DELETE /v1/tiles/{id}) -- replaces "delete event".
 *
 * The Rust DELETE handler still expects a v1 CommandEnvelope body so the
 * server can audit the action with a server-stamped idempotency_key.
 * Sending no body yields 415 (the axum Json extractor requires
 * Content-Type: application/json + a parseable JSON object), so we send
 * `{ expected_revision, idempotency_key, occurred_at, payload: { tile_id } }`.
 */
export async function upstreamArchiveTile(tileId: string): Promise<Response> {
  const headers = await bridgeHeaders({ "content-type": "application/json" });
  if (!headers) return unauthenticatedUpstreamResponse();
  const res = await fetch(`${RUST_BASE}/v1/tiles/${encodeURIComponent(tileId)}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify(envelope({ tile_id: tileId })),
  });
  if (res.status === 204) return new Response(null, { status: 204 });
  if (!res.ok) return upstreamError(res.status, await readJsonOrText(res));
  return new Response(null, { status: 204 });
}

/** Close a single placement without archiving its tile. */
export async function upstreamClosePlacement(placementId: string): Promise<Response> {
  const headers = await bridgeHeaders({ "content-type": "application/json" });
  if (!headers) return unauthenticatedUpstreamResponse();
  const res = await fetch(`${RUST_BASE}/v1/placements/${encodeURIComponent(placementId)}/close`, {
    method: "POST",
    headers,
    body: JSON.stringify(envelope({ placement_id: placementId })),
  });
  if (res.status === 204) return new Response(null, { status: 204 });
  if (!res.ok) return upstreamError(res.status, await readJsonOrText(res));
  return new Response(null, { status: 204 });
}
