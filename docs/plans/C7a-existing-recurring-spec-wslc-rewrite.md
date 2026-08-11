# C7a — wslc-ize existing recurring spec + canonical Mon-Fri assertion

## メタデータ

- **ID**: C7a
- **Phase**: 1
- **Target repo**: `tastile-web`
- **Sub-project parent**: C (recurring + SourceSchedule)
- **Depends on**: G5b (`resetDb()` 経由の pre-test cleanup), C3b (canonical weekly Mon-Fri spec)
- **Sibling plans**: C7b (recurring edit/delete E2E)
- **Source spec**: `04-sub-projects/C-recurring-source.md` §e2e 検証

## 前提

- G5b マージ済み: `tastile-web/e2e/helpers/v1.ts` の `resetDb()` は wslc 経由で 8 テーブルを TRUNCATE する (G5b:23-32)
- C3b の canonical weekly Mon-Fri (weekday_mask=0b0011111, life.active.startDate=today, life.active.endDate=today+14d) ケースが `tastile-core/v1/08` 仕様と一致 (C3b:30-37)
- 既存 `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:23-35` の `deleteAllEvents()` は docker 経由のローカル関数で G5b 適用により削除される (G5b:49-71)
- wslc stack (`tastile-db` + `tastile-v1-api` + `tastile-v1-worker`) が `bash scripts/wslc/up-v1.sh` で起動済み (G:13-19)

## 目的

既存 `quick-tile-create-recurring-e2e.spec.ts` (`:1-107`) を wslc 経路へ書き換え + C3b の canonical weekly Mon-Fri ケースを末尾に追加する。これにより:

1. 既存 spec が wslc 上で動作する (G5b の `resetDb()` 経由)
2. C3b の canonical ケースが E2E で回帰検出される
3. C sub-project 全体の integration test として ~10 placements (14d × Mon-Fri − 1 Sun exclusion) を DB count で断言する

## 受入条件

1. `bun run test:e2e -- e2e/quick-tile-create-recurring-e2e.spec.ts` が wslc 上で全 Green
2. 末尾に追加した canonical Mon-Fri test が `v1_placement` count = 10 を wslc exec psql で確認
3. 既存 test (sidebar + Recurring + 1 placement) は挙動不変 (title match + source.kind=1)
4. `deleteAllEvents()` ローカル関数が完全削除され `resetDb()` import に置換されている
5. `v1_annotation` / `v1_tile` 残留による test isolation 失敗が発生しない

## 実装手順

### Step 1: import 領域 + ローカル関数削除 (G5b と同一パターン)

`tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:1-3`:

```diff
 import { test, expect, type APIRequestContext } from "@playwright/test";
-import { v1AuthHeaders } from "./helpers/v1";
-import { execFileSync } from "node:child_process";
+import { v1AuthHeaders, resetDb } from "./helpers/v1";
```

`:23-35` の `deleteAllEvents()` 関数を完全削除し、`:38-40` の `beforeEach` を以下に置換:

```typescript
test.beforeEach(async () => {
  // recurring source tiles (v1_tile) + v1_annotation get cleared
  // alongside placements — see helpers/v1.ts resetDb()
  await resetDb();
});
```

fixture 受領は維持 (G5b リスク 4 参照)。

### Step 2: post-submit 検証の v1 timeline への統一

`:80-88` の `GET /api/events/occurrences` (v0, 410 Gone) は G5c と並走して既に `:92-105` の `/api/proxy/v1/timeline` で補完されている。本 C7a では occurrences 行を削除し timeline 行のみに統一する:

```diff
-    const occUrl = `/api/events/occurrences?start=${prev}T00:00:00.000Z&end=${next}T23:59:59.999Z&min_minutes=0&include_recurring=true`;
-    const occ = await page.request.get(occUrl);
-    expect(occ.ok()).toBeTruthy();
-    const occData = (await occ.json()) as {
-      occurrences: Array<{ title: string; source?: { kind?: number } }>;
-    };
-    const match = (occData.occurrences ?? []).find((o) => o.title === title);
-    expect(match, `expected placement with title "${title}" in occurrences`).toBeDefined();
-    expect(match?.source?.kind, "expected source.kind = 1 (recurring)").toBe(1);
-
-    // And the v1 /v1/timeline should include a placement sourced from
-    // the new recurring tile.
+    // v1 /v1/timeline is the only post-submit verification — /api/events/occurrences
+    // is v0 (410 Gone). The recurring's first placement should appear today
+    // (9:00-10:00 UTC) with source.kind = 1.
     const ownerId = "00000000-0000-0000-0000-000000000001";
     const actorId = "00000000-0000-0000-0000-000000000001";
     const tlRes = await page.request.get(
       `/api/proxy/v1/timeline?start=${prev}T00:00:00.000Z&end=${next}T23:59:59.999Z`,
       { headers: v1AuthHeaders() },
     );
```

### Step 3: canonical Mon-Fri test 追加 (`:108` 末尾)

`:107` の閉じ括弧直前に C3b の canonical weekly ケースを追加:

```typescript
  test("canonical weekly Mon-Fri produces ~10 placements over 14 days", async ({
    page,
  }) => {
    const title = "Canonical Mon-Fri " + Date.now();
    const day = todayUtc();
    const start = day;
    const end = new Date(new Date(day + "T00:00:00Z").getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const prev = new Date(new Date(day + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const windowEnd = new Date(new Date(end + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await page.goto("/dashboard/timeline/day");
    await page.getByTestId("sidebar-new-tile").first().click();

    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeVisible();

    // Switch kind to Recurring.
    const kindGroup = page.getByTestId("quick-create-tile-kind");
    await kindGroup.getByRole("radio", { name: /Recurring|定期|周期|繰り返し/i }).click();

    // Fill title.
    await page.locator("input[aria-required=\"true\"]").first().fill(title);

    // Fill §5 Recurring: weekly Mon-Fri (weekdayMask 0b0011111), life 14d.
    await page.getByTestId("quick-create-recurring-weekday-mask").fill("31");
    await page.getByTestId("quick-create-recurring-life-start").fill(start);
    await page.getByTestId("quick-create-recurring-life-end").fill(end);

    await submit.click();
    await expect(submit).not.toBeVisible();

    // Wait for worker to materialize placements (poll loop, ~3s).
    const ownerId = "00000000-0000-0000-0000-000000000001";
    const expected = 10; // 14d × Mon-Fri = 10 weekdays, 0 Sundays in window
    let count = 0;
    for (let i = 0; i < 20; i++) {
      const res = await page.request.get(
        `/api/proxy/v1/timeline?start=${prev}T00:00:00.000Z&end=${windowEnd}T23:59:59.999Z`,
        { headers: v1AuthHeaders() },
      );
      expect(res.ok()).toBeTruthy();
      const tl = (await res.json()) as Array<{ content: { title: string } }>;
      count = (tl ?? []).filter((p) => p.content?.title === title).length;
      if (count >= expected) break;
      await page.waitForTimeout(500);
    }
    expect(count, `expected ${expected} placements for Mon-Fri over 14d`).toBeGreaterThanOrEqual(expected);

    // DB-level assertion: weekday_mask=31 rows in v1_source_schedule.
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync(
      "wslc",
      ["container", "exec", "tastile-db", "psql", "-U", "tastile", "-d", "tastile_db", "-tA", "-c",
       "SELECT count(*) FROM v1_placement p JOIN v1_source_schedule s ON p.source_schedule_id=s.id WHERE s.generation->>'weekday_mask'='31';"],
      { encoding: "utf8" },
    ).trim();
    expect(Number(out), `expected ~10 placements with weekday_mask=31, got ${out}`).toBeGreaterThanOrEqual(expected);
  });
```

`testid` 命名は `tastile-web/src/components/quick-create/` 配下の実装に依存するため、C3b マージ後の `data-testid` 追加タスクと並走して調整する。候補が無い場合は `getByLabel` / `getByRole` にフォールバック (C3b:30-37)。

## 検証手順

```bash
cd tastile-web

# 1. stack が healthy
curl -s http://127.0.0.1:31400/v1/health
wslc container ls | grep -E "tastile-db|tastile-v1-api|tastile-v1-worker"

# 2. 既存 spec が wslc 経路で green
bun run test:e2e -- e2e/quick-tile-create-recurring-e2e.spec.ts
# 期待: 2 passed (existing + canonical Mon-Fri)

# 3. canonical ケースの DB count を独立に確認
wslc container exec tastile-db psql -U tastile -d tastile_db \
  -c "SELECT count(*) FROM v1_placement p JOIN v1_source_schedule s ON p.source_schedule_id=s.id WHERE s.generation->>'weekday_mask'='31';"
# 期待: 10 (14d × Mon-Fri, 0 Sundays in window)

# 4. v1_tile が post-submit で増えていること (G5b 検証 §2 と同等)
wslc container exec tastile-db psql -U tastile -d tastile_db \
  -c "SELECT count(*) FROM v1_tile;"
# before: 0  → after: >= 2 (existing test + canonical)
```

## リスク

- **stale docker exec 呼び出し残置**: `:23-35` の `deleteAllEvents` を完全削除しなかった場合、G5b マージと衝突して `import { resetDb }` が unresolved になる (G5b リスク 2)
- **poll timeout 過小**: worker materialize が 3s で完了しない環境では `count >= 10` に到達せず失敗。20 回 × 500ms = 10s を上限とするが CI で再調整要
- **wslc worker 不在**: `tastile-v1-worker` container が落ちていると placement が materialize されず `v1_placement` が空のまま。`scripts/wslc/status.sh` で起動確認
- **weekday_mask bit order 不一致**: web の `0b0011111` (Mon-Fri) と core の bit-7 マッピングが逆転していると 14d 全てが生成されて 14 placements になる (C-recurring-source.md:71-74)。DB count assertion で検出可能
- **testid 命名衝突**: `quick-create-recurring-weekday-mask` 等の `data-testid` が C3b 側で未定義だと selector not found。Step 3 のフォールバックに逃げる
- **`ownerId` UUID 固定値**: `:92` の `00000000-0000-0000-0000-000000000001` はテスト用固定 UUID。bridge auth 経路では v5 hash 化された値が必要 (project memory: v1 bridge auth derives owner_id via UUIDv5)。`v1AuthHeaders()` ヘルパーが既に wrap しているなら OK、していなければ v5 hash 注入
- **JST タイムゾーン固定**: `todayUtc()` は `Asia/Tokyo` 固定 (`:16`)。CI runner が UTC だと日付境界がずれて ~10 ではなく 9 や 11 になる

## 関連

- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §e2e 検証 (lines 46-59)
- **Sibling**: G5b (`resetDb()` への切替) — `tile-create-e2e-wiring/04-plans/G5b-spec-truncate-extend.md`
- **Sibling**: C3b (canonical weekly Mon-Fri UI spec) — `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` 参照
- **Sibling**: C7b (recurring edit/delete E2E) — 次の integration test
- **Source stack**: `tile-create-e2e-wiring/04-sub-projects/G-stack-up.md` §4 (lines 39-54)
- **Implementation order**: `tile-create-e2e-wiring/05-impl-order.md`

## 触るファイル一覧 (cite)

- `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:1-3` (import 拡張)
- `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:23-35` (deleteAllEvents 削除)
- `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:38-40` (beforeEach 置換)
- `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:80-88` (occurrences 行削除)
- `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:107` (canonical test 追加)
- `tastile-web/e2e/helpers/v1.ts` (G5a 側で `resetDb()` 追加済み) — 本 C7a では触らない
