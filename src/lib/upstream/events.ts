//! Upstream bridge: when TASTILE_USE_RUST_CORE=1, the Next.js
//! calendar routes forward requests to the v1 Rust API running on
//! http://localhost:31400.  Calendar data flows through v1 tiles,
//! v1 placements, and /v1/timeline; the v0 /v1/events CRUD surface
//! has been removed.  This module owns URL construction, the
//! snake_case <-> camelCase field conversion, and HTTP error mapping.

import { cookies } from "next/headers";
import { COOKIE_USER_SUB } from "@/lib/cognito/cookies";

const RUST_BASE = process.env.TASTILE_RUST_API_URL ?? "http://127.0.0.1:31400";
const DEV_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

type AnyObj = Record<string, unknown>;

function snakeKeyToCamelKey(k: string): string {
  return k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camelKeyToSnakeKey(k: string): string {
  return k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
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
  const detail = (body as { error?: string } | null)?.error;
  const message = detail ?? `Upstream returned ${status}`;
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function bridgeHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const userSub = cookieStore.get(COOKIE_USER_SUB)?.value;
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (userSub && bridgeSecret) {
    headers["x-tastile-web-bridge-secret"] = bridgeSecret;
    headers["x-tastile-web-session-user"] = userSub;
  } else {
    headers["x-owner-id"] = DEV_ACTOR_ID;
    headers["x-actor-id"] = DEV_ACTOR_ID;
  }
  return headers;
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
  const headers = await bridgeHeaders();
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
      allDay: false,
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
 */
export async function upstreamCreateCalendarEvent(
  input: CalendarCreateInput,
): Promise<Response> {
  const headers = await bridgeHeaders({ "content-type": "application/json" });

  const tileRes = await fetch(`${RUST_BASE}/v1/tiles`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      toSnake({
        title: input.title,
        description: input.description ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
      }),
    ),
  });
  if (!tileRes.ok) return upstreamError(tileRes.status, await readJsonOrText(tileRes));
  const tileBody = (await readJsonOrText(tileRes)) as Record<string, unknown> | null;
  const tileId = String(
    (tileBody && (tileBody["tile_id"] ?? tileBody["id"])) || "",
  );
  if (!tileId) {
    return upstreamError(500, { error: "create tile returned no id" });
  }

  const placementRes = await fetch(`${RUST_BASE}/v1/placements`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tile_id: tileId,
      span_start: toUtcIso(input.start),
      span_end: toUtcIso(input.end),
      source_kind: 0,
    }),
  });
  if (!placementRes.ok) {
    return upstreamError(placementRes.status, await readJsonOrText(placementRes));
  }
  const placementBody = (await readJsonOrText(placementRes)) as
    | Record<string, unknown>
    | null;
  const placementId = String(
    (placementBody && (placementBody["placement_id"] ?? placementBody["id"])) ||
      "",
  );
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
  const res = await fetch(
    `${RUST_BASE}/v1/tiles/${encodeURIComponent(tileId)}/update`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(toSnake(patch)),
    },
  );
  if (!res.ok) return upstreamError(res.status, await readJsonOrText(res));
  const tile = await readJsonOrText(res);
  return new Response(JSON.stringify({ tile: toCamel(tile) }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Archive v1 tile (DELETE /v1/tiles/{id}) -- replaces "delete event". */
export async function upstreamArchiveTile(tileId: string): Promise<Response> {
  const headers = await bridgeHeaders();
  const res = await fetch(`${RUST_BASE}/v1/tiles/${encodeURIComponent(tileId)}`, {
    method: "DELETE",
    headers,
  });
  if (res.status === 204) return new Response(null, { status: 204 });
  if (!res.ok) return upstreamError(res.status, await readJsonOrText(res));
  return new Response(null, { status: 204 });
}

/** Close a single placement without archiving its tile. */
export async function upstreamClosePlacement(placementId: string): Promise<Response> {
  const headers = await bridgeHeaders();
  const res = await fetch(
    `${RUST_BASE}/v1/placements/${encodeURIComponent(placementId)}/close`,
    {
      method: "POST",
      headers,
    },
  );
  if (res.status === 204) return new Response(null, { status: 204 });
  if (!res.ok) return upstreamError(res.status, await readJsonOrText(res));
  return new Response(null, { status: 204 });
}
