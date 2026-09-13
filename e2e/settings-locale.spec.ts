import { test, expect } from "@playwright/test";

const LOCALES = ["en", "ja", "zh-CN", "ko", "es"] as const;
type Locale = (typeof LOCALES)[number];

// Free-user SubscriptionSection forbidden copy: W06 #81 AC "未提供の
// Mac/iOS/Desktop 同期/無制限/offline を約束しない" + "checkout/upgrade
// の UI と server 入口を無効化し".  We test the *free* user rendering (the
// isPro=false branch) which is what every new 9/19 signup sees.
const FORBIDDEN_FREE_USER_PATTERNS: Record<Locale, RegExp[]> = {
  en: [
    /upgrade/i,
    /\bunlock\b/i,
    /windows/i,
    /\bmac\b/i,
    /\bios\b/i,
    /offline/i,
    /desktop sync/i,
    /unlimited/i,
    /\bpro plan\b/i,
  ],
  ja: [
    /アップグレード/,
    /Pro.*アップグレード/,
    /Windows/,
    /Mac/,
    /iOS/,
    /オフライン/,
    /デスクトップ同期/,
    /無制限/,
  ],
  "zh-CN": [/升级/, /Pro.*升级/, /Windows/, /Mac/, /iOS/, /离线/, /桌面同步/, /无限/],
  ko: [/업그레이드/, /Pro.*업그레이드/, /Windows/, /Mac/, /iOS/, /오프라인/, /데스크톱/, /무제한/],
  es: [
    /actualizar/i,
    /desbloquear/i,
    /windows/i,
    /\bmac\b/i,
    /\bios\b/i,
    /offline/i,
    /escritorio/i,
    /ilimitad/i,
  ],
};

// W06 #81 honest copy (post round-3 fix) — every locale carries a
// non-promising free-user description that points at the actual 9/19
// launch state.  If the description regresses to "Upgrade to ..." these
// assertions fail and the W06 AC violation surfaces.
const FREE_USER_DESCRIPTION: Record<Locale, RegExp> = {
  en: /only plan|9\/?19|free of charge|no upgrade path/i,
  ja: /唯一のプラン|9\/?19|アップグレード経路はありません/,
  "zh-CN": /唯一可用的计划|9\/?19|暂无升级/,
  ko: /유일한 요금제|9\/?19|업그레이드 경로는 없습니다/,
  es: /único plan|9\/?19|sin ruta de mejora/i,
};

// Reuse the bridge-auth storageState shape — the dev server's
// E2E_BYPASS_AUTH=0 path resolves the tastile_uid cookie into a UUIDv5
// owner via the v1 bridge.  This is the same path that
// bridge-auth.e2e.spec.ts exercises against the real daemon.
const STORAGE_STATE = {
  cookies: [
    {
      name: "tastile_uid",
      value: "e2e-settings-locale-user",
      domain: "127.0.0.1",
      path: "/",
      expires: -1,
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
};

test.describe("W06 #81 settings locale real-browser verification (free user)", () => {
  for (const locale of LOCALES) {
    test.use({ storageState: STORAGE_STATE });
    test(`/${locale}/dashboard/preferences/account free user renders honest copy, no upgrade`, async ({
      page,
    }) => {
      // SubscriptionSection only renders when the "subscription" tab is
      // active (the page defaults to "profile").  Use ?tab=subscription
      // so the subscription section appears regardless of default.
      // SubscriptionSection reads /api/billing/subscription.  The dev
      // server has STRIPE_SECRET_KEY unset, so the Stripe lookup fails
      // inside getSubscriptionForUser's catch and returns
      // { status: "free" } — every test user is a free user in this env.
      await page.goto(
        `/dashboard/preferences/account?lang=${encodeURIComponent(locale)}&tab=subscription`,
      );
      await expect(page.getByRole("heading", { level: 3 })).toBeVisible();

      // Wait for the subscription fetch to settle and the Free plan card
      // to render.  The free description text is the W06 honest copy.
      const freeHeading = page.getByRole("heading", { name: /^free$/i }).first();
      await expect(freeHeading).toBeVisible();
      await expect(page.getByText(FREE_USER_DESCRIPTION[locale])).toBeVisible();

      // No paid-tier h2 (Pro / Enterprise / Premium).
      await expect(
        page.getByRole("heading", { name: /^pro$|^enterprise$|^premium$/i }),
      ).toHaveCount(0);

      // No upgrade / unlock / unlock-promising copy on interactive
      // elements (button / link / headings).  Scoping to interactive
      // elements lets the description prose explicitly say "no upgrade
      // path" without triggering the assertion (the full description
      // `...アップグレード経路はありません。` is intentional negation).
      const interactiveText = await page
        .locator("main button, main a, main h1, main h2, main h3, main h4, main h5, main h6")
        .allInnerTexts()
        .then((arr) => arr.join("\n"));
      for (const pattern of FORBIDDEN_FREE_USER_PATTERNS[locale]) {
        expect(
          pattern.test(interactiveText),
          `locale ${locale}: forbidden free-user promise ${pattern} must not appear on /dashboard/preferences/account CTAs/headings`,
        ).toBe(false);
      }
    });
  }
});
