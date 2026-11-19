# B1a — placement time-window endpoint discovery

## メタデータ

- **ID**: B1a
- **Phase**: 1
- **Target repos**: `tastile-core`, `tastile-web`
- **Sub-project parent**: B (time + windows)
- **Depends on**: G1a/G1b (wslc stack), H (bridge auth), A1a (tile create), A4b (tile edit)
- **Sibling plans**: B1b (window math), B2a (resolve call from web)
- **Source of truth**: `tastile-core/v1/02-core-entities.md`, `v1/03-time-and-windows.md`, `v1/07-resolution.md`, `v1/10-invariants.md`, `v1/14-read-model-and-endpoint.md`

## 前提

- B1a is discovery and contract pinning, not an implementation of the resolver or UI flow. Do not add a new endpoint or a second scheduling path.
- The active backend workspace is `tastile-core/crates-v1`; the root repository is only a shell. Backend verification must use the wslc/WSL PostgreSQL path described by `tastile-core/CLAUDE.md`.
- The web client is thin: it sends the core request and renders the read model. It must not calculate recurring occurrences or reconstruct effective placement state.
- The current route registration in `tastile-core/crates-v1/api/src/main.rs:281-697` exposes `GET /v1/placements` at lines 647-649. The endpoint names in this plan (`POST /v1/placements/resolve`, `/lock`, `/unlock`) are the target contract to discover/verify; if a requested route is absent in the checked-out core, record the mismatch and stop rather than silently substitute `/v1/timeline` or manual `POST /v1/placements`.

## 目的

Document the exact core wire contract for generating and reading placement rows in a bounded time window, including the lock state transition. Establish one observable path for QuickCreate: after `POST /v1/tiles` returns `201`, web calls resolve exactly once for the tile plan window `[tile.plan.start - 1d, tile.plan.end + 1d)`, and repeats that call once after an edit changes the affected window.

## エンドポイント契約

### 1. Resolve generated placements

`POST /v1/placements/resolve`

Request JSON (exact target shape):

```json
{
  "tile_id": "01900000-0000-7000-8000-000000000001",
  "window": {
    "since": "2026-08-03T00:00:00Z",
    "until": "2026-08-10T00:00:00Z",
    "tz": "UTC"
  }
}
```

`window` is a half-open interval `[since, until)`. `since` and `until` are ISO 8601 instants; the server stores absolute time in UTC. `tz` identifies the recurrence/calendar interpretation zone and accepts IANA values such as `UTC` and `Asia/Tokyo`. The response must be HTTP `200` with the resolved read-model envelope:

```json
{
  "placements": [
    {
      "placement_id": "01900000-0000-7000-8000-000000000010",
      "tile_id": "01900000-0000-7000-8000-000000000001",
      "plan_id": "01900000-0000-7000-8000-000000000002",
      "title": "Daily review",
      "locked": false,
      "span_start": "2026-08-03T09:00:00Z",
      "span_end": "2026-08-03T09:30:00Z"
    }
  ]
}
```

The implementation step must confirm every field name and optional/null representation against the actual handler request/response structs in `crates-v1/api/src/main.rs:258-710` and the handler modules it calls. Do not infer camelCase from the web model: the HTTP wire is snake_case where the Rust serde contract says so.

### 2. List placements in a window

`GET /v1/placements?owner_id=<uuid>&since=<ISO8601>&until=<ISO8601>`

Expected success JSON:

```json
{
  "placements": [
    {
      "placement_id": "01900000-0000-7000-8000-000000000010",
      "tile_id": "01900000-0000-7000-8000-000000000001",
      "plan_id": "01900000-0000-7000-8000-000000000002",
      "title": "Daily review",
      "locked": false,
      "span_start": "2026-08-03T09:00:00Z",
      "span_end": "2026-08-03T09:30:00Z"
    }
  ]
}
```

The query uses the same half-open `[since, until)` window and owner scope. The current `list_placements` implementation at `tastile-core/crates-v1/api/src/handlers/read.rs:1068-1145` returns a raw JSON array and currently selects close/detach/source fields rather than the target `{placements:[...]}` shape; this is a contract gap to resolve explicitly in B2a or a follow-up core plan. B1a must preserve this finding and must not claim the acceptance criterion until a live response has the object envelope and window filtering.

### 3. Lock and unlock a placement

- `POST /v1/placements/{id}/lock`
- `POST /v1/placements/{id}/unlock`

Request body: `{}` (or no body only if the actual handler proves that contract). Expected response is HTTP `200` with the updated placement/read-model or command result, using the exact Rust serde shape discovered in the handler. The observable invariant is the persisted placement's `locked` flag: lock changes it to `true`, unlock changes it to `false`, and a subsequent window list/read observes the same value. Lock is a placement pin, not a client-side decoration.

## Resolve timing and callers

1. **A1a create path**: after QuickCreate's `POST /v1/tiles` receives HTTP `201`, extract the returned tile and plan window, then fire exactly one `POST /v1/placements/resolve` within 1 second. The requested resolve window is `[tile.plan.start - 1 day, tile.plan.end + 1 day)`. Do not issue a second resolve through timeline loading, retry loops, or manual placement creation.
2. **A4b edit path**: after a tile edit succeeds, re-fire exactly one resolve for the newly affected window. B1b owns the date/time arithmetic; B2a owns the web call and deduplication behavior.
3. **URL constants**: add or verify the canonical constants in `tastile-web/src/shared/api/v1/endpoints.ts`: `V1_PLACEMENTS_RESOLVE_URL`, `V1_PLACEMENTS_URL`, and `V1_PLACEMENTS_LOCK_URL`. The lock constant must represent the `{id}` route template or be a function that safely interpolates an encoded UUID; do not scatter literal endpoint strings across QuickCreate, hooks, and tests.

## 受入条件

- A real `curl` POST to `/v1/placements/resolve` with `{tile_id, window:{since,until,tz}}` returns HTTP `200` and `{placements:[...]}` containing at least one placement for a daily-recurring tile.
- `GET /v1/placements?owner_id=&since=&until=` returns the same placement IDs and spans as resolve, constrained to `[since, until)`.
- Lock then list/read shows `locked: true`; unlock then list/read shows `locked: false` on the same placement row.
- A QuickCreate-created tile produces exactly one `/v1/placements/resolve` request within 1 second after the tile-create `201` response.
- Re-editing a tile produces exactly one re-resolve request for the new affected window.
- All request/response fields documented above match the live handler and wire output; any mismatch is recorded as a blocking contract gap, not papered over in the web client.

## 実装手順

1. Re-read the canonical v1 time/window, placement, resolution, and endpoint chapters; list the relevant ATs (placement generation, idempotency, effective read model, and window boundaries).
2. Locate the route registrations and handler implementations from `tastile-core/crates-v1/api/src/main.rs:258-710`; record the actual request structs, query structs, response structs, serde attributes, authentication, owner authorization, and status codes.
3. Compare the discovered backend contract with `tastile-web/src/shared/api/v1/endpoints.ts` and existing v1 client helpers. Record absent constants and literal call sites; do not modify unrelated endpoint documentation.
4. Create/adjust the contract test fixture for a daily-recurring tile and a fixed UTC window. Assert resolve response shape, placement count, IDs, spans, and half-open exclusion at `until`.
5. Add the lock/unlock verification to the same endpoint-level test or a focused sibling test. Assert persistence by reading the placement again, not merely trusting the mutation response.
6. Wire the A1a create and A4b edit call sites only in B2a. Use this plan's constants and the B1b window helper; enforce one invocation per successful mutation and no timer/polling-triggered duplicate.
7. Commit the plan/contract work separately from implementation using the repository's Conventional Commit style, for example `docs(v1): document placement window endpoint contract`.

## 検証手順

Use a running wslc stack and a fresh owner/test database. Substitute real UUIDs and credentials; never put secrets in this plan.

```bash
BASE=http://127.0.0.1:31400
OWNER=<owner-uuid>
TILE=<daily-recurring-tile-uuid>
SINCE=2026-08-03T00:00:00Z
UNTIL=2026-08-10T00:00:00Z

curl -i -X POST "$BASE/v1/placements/resolve" \
  -H 'content-type: application/json' \
  -H "x-owner-id: $OWNER" -H "x-actor-id: $OWNER" \
  -d "{\"tile_id\":\"$TILE\",\"window\":{\"since\":\"$SINCE\",\"until\":\"$UNTIL\",\"tz\":\"UTC\"}}"
# Expected: HTTP/1.1 200 and JSON object with placements array; daily tile count >= 1.

curl -sG "$BASE/v1/placements" \
  --data-urlencode "owner_id=$OWNER" \
  --data-urlencode "since=$SINCE" \
  --data-urlencode "until=$UNTIL" \
  -H "x-owner-id: $OWNER" -H "x-actor-id: $OWNER"
# Expected: same placement IDs/spans, no span_start >= UNTIL.

PLACEMENT=<placement-uuid>
curl -i -X POST "$BASE/v1/placements/$PLACEMENT/lock" \
  -H 'content-type: application/json' -d '{}'
# Expected: HTTP 200; follow with GET/list and observe locked=true.

curl -i -X POST "$BASE/v1/placements/$PLACEMENT/unlock" \
  -H 'content-type: application/json' -d '{}'
# Expected: HTTP 200; follow with GET/list and observe locked=false.
```

For browser proof, run the QuickCreate Playwright test with request interception. Capture timestamps for the tile `201` and resolve request; assert `0 <= resolveAt - tileCreatedAt <= 1000ms` and exactly one matching request. Repeat after editing and assert one request whose `since`/`until` equal the new B1b window. A passing unit test without observed network traffic is insufficient.

## リスク

- **Route/shape drift**: the checked-out core may not yet register resolve/lock/unlock, or list may return an array. Treat this as a blocking discovery result and create a core follow-up; do not alias a different endpoint.
- **Window boundary errors**: inclusive `until`, local-time parsing, or date-only strings can create duplicate/out-of-window placements. Keep `[since, until)` and UTC serialization explicit; B1b owns arithmetic.
- **Duplicate resolve calls**: React effects, retries, timeline refresh, or SSE can re-fire generation. Guard the mutation-success path and assert exact request count in Playwright.
- **Auth/owner mismatch**: `owner_id` query parameters must be authorized server-side. Use bridge headers or the authenticated bearer path and verify cross-owner reads do not leak rows.
- **Lock read-model lag**: validate the flag with a subsequent core read/list and allow no client-only optimistic claim in the acceptance evidence.

## 関連

- `tastile-core/crates-v1/api/src/main.rs:281-697` — route registration; current placement list route at `647-649`
- `tastile-core/crates-v1/api/src/handlers/read.rs:1068-1145` — current placement list handler and observed response gap
- `tastile-web/src/shared/api/v1/endpoints.ts` — canonical web URL constants
- `tastile-web/src/shared/api/v1/tile-commands.ts:639-663` — existing manual placement command path to avoid duplicating for recurring resolve
- `tile-create-e2e-wiring/04-plans/G1a-wslc-image-build.md` — structural template
- `tile-create-e2e-wiring/04-plans/B1b-window-math.md` — sibling window arithmetic contract
- `tile-create-e2e-wiring/04-plans/B2a-resolve-call-from-web.md` — sibling web invocation plan
- `tile-create-e2e-wiring/05-impl-order.md` — execution ordering
