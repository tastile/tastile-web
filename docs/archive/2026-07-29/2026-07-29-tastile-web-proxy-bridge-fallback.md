# tastile-web /api/proxy bridge-auth fallback

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop every `/api/proxy/*` request from returning 401 in production when the browser still has a valid Cognito session but the `tastile_api_token` cookie is stale. Forward `x-tastile-web-bridge-secret` + `x-tastile-web-session-user` from the proxy so the daemon's bearer-fall-through bridge auth path (2026-07-22) can rescue the request.

**Architecture:** Reuse the proven `ensureBridgeAuth(...)` helper that already powers `/api/account/tokens`, `/api/auth/session`, and `src/lib/upstream/events.ts`. After (or instead of) reading the `tastile_api_token` cookie, the proxy reads `tastile_uid` and attaches the two bridge headers. Daemon's `bearer_auth_result` returns `Ok(None)` on stale/unknown Bearer (the 2026-07-22 fall-through), `bridge_auth_from_headers` then succeeds with the new headers — no manual logout/login needed.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest. No new dependencies.

---

## Background — what we know from the 2026-07-28 incident

- `crates/v1/api/src/handlers/common.rs:792-807` — `bridge_auth_from_headers` is a simple string compare on `TASTILE_WEB_BRIDGE_SECRET`. Mismatch returns `None` and falls through to Bearer.
- `crates/v1/api/src/handlers/common.rs` (2026-07-22 commit) — Bearer lookup now returns `Ok(None)` for stale/unknown tokens and falls through to bridge auth instead of hard 401.
- `src/app/api/proxy/[...path]/route.ts:27-45` — Today sends **only** `Authorization: Bearer <api_token>`. No bridge headers.
- `src/lib/cognito/cookies.ts:7` — `COOKIE_USER_SUB = "tastile_uid"`. This is the CF-WAF-safe cookie holding the Cognito `sub`. Set by `setAuthCookies` at `src/lib/cognito/cookies.ts:53`.
- The proven bridge-header pattern exists at three call sites already: `src/app/api/account/tokens/route.ts:15-30`, `src/app/api/auth/session/route.ts:35-49`, `src/lib/upstream/events.ts:126-138`.

## Files

- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\api\proxy\[...path]\route.ts`
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\api\proxy\route.test.ts`

## Acceptance

- Proxy sends both `Authorization: Bearer <api_token>` AND the two bridge headers when both cookies are present.
- Proxy still sends Bearer when only the API-token cookie is present (preserves existing callers).
- Proxy sends bridge headers but no Bearer when only `tastile_uid` is present (rescues the 2026-07-28 incident without forcing logout).
- Proxy returns the existing 401 JSON when neither cookie is present.
- All existing tests in `src/app/api/proxy/route.test.ts` continue to pass.
- Production smoke: `curl https://app.tastile.app/api/proxy/v1/access/subjects?kind=1` with valid `tastile_uid` cookie returns 200 (was 401).

---

### Task 1: Write the failing tests for bridge-header forwarding

**Files:**
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\api\proxy\route.test.ts`

**Step 1:** Open `src/app/api/proxy/route.test.ts` and locate the existing "forwards API token as Bearer to core" test (around line 75-94). Keep it as-is — it verifies the no-bridge case.

**Step 2:** Add a new test immediately after it that verifies bridge-header forwarding when both cookies are present. Use the exact proven header names from `src/app/api/account/tokens/route.ts:21-24` — `x-tastile-web-bridge-secret` and `x-tastile-web-session-user`. Mirror the upstream-headers assertion pattern of the existing test (line 92-93).

```typescript
it("forwards bridge headers alongside Bearer when tastile_uid cookie is present", async () => {
  process.env.CLOUD_API_BASE = "https://core.tastile.test";
  process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("[]", { status: 200 }));
  const { GET } = await import("./[...path]/route");
  const request = new NextRequest(`${APP_BASE_URL}/api/proxy/v1/tiles`, {
    headers: {
      cookie: "tastile_api_token=my-api-token-123; tastile_uid=cognito-sub-abc",
    },
  });

  const response = await GET(request, {
    params: Promise.resolve({ path: ["v1", "tiles"] }),
  });

  expect(response.status).toBe(200);
  const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
  expect(upstreamHeaders.get("authorization")).toBe("Bearer my-api-token-123");
  expect(upstreamHeaders.get("x-tastile-web-bridge-secret")).toBe("test-bridge-secret");
  expect(upstreamHeaders.get("x-tastile-web-session-user")).toBe("cognito-sub-abc");
});
```

**Step 3:** Add a test for the rescue path — stale `tastile_api_token` cookie but valid `tastile_uid` cookie should still send the request (no 401). This is the **actual production scenario** from the 2026-07-28 incident.

```typescript
it("forwards bridge headers without Bearer when only tastile_uid cookie is present", async () => {
  process.env.CLOUD_API_BASE = "https://core.tastile.test";
  process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("[]", { status: 200 }));
  const { GET } = await import("./[...path]/route");
  const request = new NextRequest(`${APP_BASE_URL}/api/proxy/v1/tiles`, {
    headers: {
      cookie: "tastile_uid=cognito-sub-abc",
    },
  });

  const response = await GET(request, {
    params: Promise.resolve({ path: ["v1", "tiles"] }),
  });

  expect(response.status).toBe(200);
  const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
  expect(upstreamHeaders.get("authorization")).toBeNull();
  expect(upstreamHeaders.get("x-tastile-web-bridge-secret")).toBe("test-bridge-secret");
  expect(upstreamHeaders.get("x-tastile-web-session-user")).toBe("cognito-sub-abc");
});
```

**Step 4:** Run the tests to confirm they fail with the missing-symbol signature that the new code will introduce.

Run: `bun test src/app/api/proxy/route.test.ts`

Expected: both new tests FAIL. The existing "forwards API token as Bearer to core" test should still PASS (it doesn't exercise bridge headers). The exact failure mode is "headers.get('x-tastile-web-bridge-secret') returned null" — the test setup will pass (response.status 200 because the existing code happily proxies when only `tastile_api_token` is present… actually it won't, the second test has no `tastile_api_token` cookie so it will 401 before any fetch is made). Either way, both new tests fail for the right reason: the proxy doesn't forward bridge headers.

**Step 5:** Commit the failing tests (Red). Do NOT include the implementation in this commit — separate commits keep the diff readable in `git log`.

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-web
git add src/app/api/proxy/route.test.ts
git commit -m "test(tastile-web): add bridge-header forwarding cases for /api/proxy"
```

---

### Task 2: Implement the bridge-header forwarding in the proxy

**Files:**
- Modify: `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\api\proxy\[...path]\route.ts`

**Step 1:** Read `src/lib/cognito/cookies.ts` to confirm the cookie name constant. From the existing import at line 2 of the proxy (`import { COOKIE_API_TOKEN } from "@/lib/cognito/cookies";`), the same file exports `COOKIE_USER_SUB = "tastile_uid"`.

**Step 2:** Replace the import line at the top of `src/app/api/proxy/[...path]/route.ts:2`:

```typescript
import { COOKIE_API_TOKEN, COOKIE_USER_SUB } from "@/lib/cognito/cookies";
```

**Step 3:** Locate the auth-block in `proxyRequest` (currently lines 28-45). Replace the existing block with the version below. The change: after reading `apiToken`, also read `userSub` from the `tastile_uid` cookie; set `Authorization: Bearer` only when `apiToken` exists; set the two bridge headers whenever `userSub` exists. This matches the proven contract at `src/lib/upstream/events.ts:134-139` and `src/app/api/account/tokens/route.ts:21-24`.

```typescript
  const headers = new Headers();

  if (getIsE2EBypass()) {
    headers.set("x-owner-id", DEV_ACTOR_SUBJECT_ID);
    headers.set("x-actor-id", DEV_ACTOR_SUBJECT_ID);
  } else {
    const apiToken = request.cookies.get(COOKIE_API_TOKEN)?.value;
    const userSub = request.cookies.get(COOKIE_USER_SUB)?.value;
    if (!apiToken && !userSub) {
      const accept = request.headers.get("accept") ?? "";
      if (accept.includes("text/html")) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "session_expired");
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.json({ error: "no authenticated session for proxy" }, { status: 401 });
    }
    if (apiToken) {
      headers.set("authorization", `Bearer ${apiToken}`);
    }
    if (userSub) {
      const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
      if (!bridgeSecret) {
        console.warn(
          "[proxy] TASTILE_WEB_BRIDGE_SECRET is unset; cannot forward bridge headers",
        );
      } else {
        headers.set("x-tastile-web-bridge-secret", bridgeSecret);
        headers.set("x-tastile-web-session-user", userSub);
      }
    }
  }
```

Notes:
- `apiToken || userSub` (logical OR) replaces `apiToken` for the gate, so a stale-token / valid-uid browser can still hit the daemon.
- Bearer header is set only when `apiToken` exists, so the rescue path sends bridge-only.
- Bridge secret comes from `process.env.TASTILE_WEB_BRIDGE_SECRET` directly — same source the existing three call sites use (`src/app/api/account/tokens/route.ts:15`, `src/app/api/auth/session/route.ts:35`, `src/lib/upstream/events.ts:126`). The env var is loaded by Next.js from `/etc/tastile/tastile-web.env` via systemd on EC2, and from `.env.local` for dev.
- The `warn` log fires only when both the user has a `tastile_uid` cookie AND `TASTILE_WEB_BRIDGE_SECRET` is missing — that combination is a deployment misconfiguration and should be loud.

**Step 4:** Run the tests to confirm the two new tests pass and the existing tests still pass.

Run: `bun test src/app/api/proxy/route.test.ts`

Expected: 9 of 9 tests pass. Specifically:
- `maps runtime and auth compatibility paths to tastile-core v1 routes` — PASS (unrelated)
- `maps pending-prompt and prompts/current to v1/prompts/pending` — PASS (unrelated)
- `injects start AND end for views/timeline/today` — PASS (unrelated)
- `preserves explicit start and end without overwrite` — PASS (unrelated)
- `rejects %s requests without API token cookie` (5 parameterized cases) — PASS (still 401 when no cookies at all; the new OR check still gates on `!apiToken && !userSub`)
- `forwards API token as Bearer to core` — PASS (unchanged; no `tastile_uid` cookie in this test, no bridge headers set)
- `forwards bridge headers alongside Bearer when tastile_uid cookie is present` — PASS (NEW)
- `forwards bridge headers without Bearer when only tastile_uid cookie is present` — PASS (NEW)
- `forwards E2E requests to core without replacing its response` — PASS (E2E branch untouched)

**Step 5:** Commit the implementation.

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-web
git add src/app/api/proxy/[...path]/route.ts
git commit -m "fix(tastile-web): forward bridge headers from /api/proxy when tastile_uid present"
```

---

### Task 3: Verify the full web test suite is still green

**Files:** none (verification only)

**Step 1:** Run lint + type-check + the full test suite to confirm no collateral damage.

Run: `bun run lint && bun run typecheck && bun test`

Expected:
- `bun run lint` exits 0 (no new lint errors)
- `bun run typecheck` exits 0 (no new TypeScript errors)
- `bun test` exits 0 (all vitest suites pass)

If anything fails, stop. The fix is supposed to be isolated — a regression means the implementation drifted from the proven pattern.

**Step 2:** Commit any lint or type fixes that surfaced (typically none).

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-web
# Only if changes exist
git add -A
git commit -m "chore(tastile-web): post-fix lint/typecheck adjustments"
```

---

### Task 4: Build the production bundle

**Files:** none (build artifact)

**Step 1:** Build the Next.js production bundle.

Run: `bun run build`

Expected: clean build, exit 0. The output `.next/` directory should contain updated chunks referencing the new code paths.

If the build fails, stop and diagnose. This is a tiny patch — a build failure means something is wrong.

---

### Task 5: Deploy to production

**Files:** none (deployment)

**Step 1:** Verify the EC2 instance id is current.

The instance id from the 2026-07-28 incident was `i-0ec20b65596468a79`. Memory `project_tastile_web_three_instances_20260706.md` records the CF→EC2 origin drift; the canonical A-record target as of 2026-07-06 is `52.194.61.218` (nginx).

Run:
```bash
aws ec2 describe-instances --instance-ids i-0ec20b65596468a79 \
  --query 'Reservations[].Instances[].State.Name' --output text
```

Expected: `running`. If not, stop and check with the user.

**Step 2:** Run the existing deploy script.

```bash
pwsh -File scripts/deploy-web.ps1
```

Expected: exit 0. The script packages the build, uploads via SSM, restarts `tastile-web.service`, and waits for `/v1/ready` to return 200.

The deployment uses `scripts/deploy-targz-pattern.md` (per memory) — `tar -a -c -f $zip -C $stageDir .` not Compress-Archive. Do not change the script.

**Step 3:** After deploy, verify the systemd service is healthy.

```bash
aws ssm send-command --instance-ids i-0ec20b65596468a79 \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["sudo systemctl is-active tastile-web.service","sudo curl -sS -o /dev/null -w \"ready=%{http_code}\\n\" http://127.0.0.1:3000/v1/ready"]}' \
  --output text
```

Expected: `active` and `ready=200`.

---

### Task 6: Production smoke test

**Files:** none (verification)

**Step 1:** Confirm the daemon-side bearer-fall-through bridge auth (2026-07-22 commit) is still in production.

Run:
```bash
aws ssm send-command --instance-ids i-0ec20b65596468a79 \
  --document-name "AWS-RunShellScript" \
  --parameters file:///tmp/proxy-bridge-smoke.json \
  --output text
```

Where `/tmp/proxy-bridge-smoke.json` contains (escape carefully, then `base64 -w0` the curl command to avoid cp932 Unicode issues from any daemon output):

```json
{
  "commands": [
    "bash -c 'set -e; CMD=$(echo \"curl -sS -o /dev/null -w \\\"http=%{http_code}\\\\n\\\" http://127.0.0.1:3000/api/proxy/v1/access/subjects?kind=1 -H \\\"Cookie: tastile_uid=test-smoke-sub\\\" | base64 -w0\"); echo \"$CMD\" > /tmp/proxy-smoke.sh; cat /tmp/proxy-smoke.sh'"
  ]
}
```

The goal is to verify that the proxy route returns a non-401 (likely 401 too, because the `test-smoke-sub` doesn't have a real bridge-secret match) — confirming the route reaches the daemon and isn't blocked at the proxy.

A cleaner version that exercises the actual fix is to log in to the production app in a browser, then curl through CloudFlare. Save that for the manual check in Step 2.

**Step 2:** Manual browser smoke test.

Open https://app.tastile.app/dashboard in a browser. Open DevTools → Network tab. Hard-reload. Confirm:
- No `401 (Unauthorized)` entries in the console
- `/api/proxy/read/tiles?limit=200`, `/api/proxy/access/subjects?kind=1`, `/api/proxy/read/active-tile`, `/api/proxy/read/execution-view`, `/api/proxy/access/notifications?limit=20` all return 200

Expected: 0 errors. Dashboard renders with tile list, active tile, notifications.

**Step 3:** Confirm via cookie jar that the `tastile_uid` cookie is present.

Run in DevTools console:
```javascript
document.cookie.split('; ').filter(c => c.startsWith('tastile_'))
```

Expected: at least `tastile_uid=...` is present (it's httpOnly so document.cookie won't show it, but the proxy now reads it server-side). If `tastile_uid` is missing but `tastile_id_token` exists, the user needs to log out and back in to repopulate it — that triggers `setAuthCookies` which writes `tastile_uid`.

---

### Task 7: Close the plan

**Files:** none

**Step 1:** Update `docs/HARNESS.md` if there is an implementation history section in the web harness.

Read `C:\Users\rebui\Desktop\tastile\tastile-web\CLAUDE.md` and `docs/HARNESS.md` (if it exists for tastile-web). Add a short bullet under "Implementation History" summarizing this fix.

**Step 2:** Done. Hand off to the user with:
- the two new test names
- the prod-build version (typically `git rev-parse HEAD`)
- the SSM CommandId from the production smoke
- the URL of the manual smoke screenshot (if captured)