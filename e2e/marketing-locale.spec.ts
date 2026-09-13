import { test, expect } from "@playwright/test";

const LOCALES = ["en", "ja", "zh-CN", "ko", "es"] as const;
type Locale = (typeof LOCALES)[number];

const FORBIDDEN_PROMISE_PATTERNS: Record<string, RegExp[]> = {
  en: [
    /\bwindows\b/i,
    /\bmac\b/i,
    /\bipad\b/i,
    /\biphone\b/i,
    /\bio\s+(?:s|app|mobile)\b/i,
    /desktop\s+sync/i,
    /offline\s+(?:mode|sync|storage)/i,
    /unlimited\s+(?:tiles|tasks|history|api)/i,
    /\bsync\b.*\b(desktop|windows|mac)\b/i,
  ],
  ja: [
    /Windows/,
    /Mac/,
    /iPad/,
    /iPhone/,
    /iOS/,
    /オフライン/,
    /デスクトップ同期/,
    /デスクトップ版/,
    /無制限/,
    /同期.*(?:デスクトップ|Windows|Mac)/,
  ],
  "zh-CN": [
    /Windows/,
    /Mac/,
    /iPad/,
    /iPhone/,
    /iOS/,
    /离线/,
    /桌面版/,
    /桌面同步/,
    /无限/,
    /同步.*(?:桌面|Windows|Mac)/,
  ],
  ko: [
    /Windows/,
    /Mac/,
    /iPad/,
    /iPhone/,
    /iOS/,
    /오프라인/,
    /데스크톱\s*동기/,
    /데스크톱\s*버전/,
    /무제한/,
    /동기화.*(?:데스크톱|Windows|Mac)/,
  ],
  es: [
    /\bwindows\b/i,
    /\bmac\b/i,
    /\bipad\b/i,
    /\biphone\b/i,
    /\bios\b/i,
    /offline/i,
    /escritorio/i,
    /ilimitad/i,
    /sincronización.*(?:escritorio|Windows|Mac)/i,
  ],
};

const UPGRADE_COPY: Record<Locale, RegExp[]> = {
  en: [/upgrade to pro/i, /\bsubscribe\b/i, /\bcheckout\b/i],
  ja: [/Pro.*アップグレード/, /アップグレード/, /購読/],
  "zh-CN": [/升级到\s*Pro/, /升级/, /订阅/],
  ko: [/Pro.*업그레이드/, /업그레이드/, /구독/],
  es: [/actualizar a pro/i, /suscrib/i],
};

const FREE_HEADING: Record<Locale, RegExp> = {
  en: /free.*9\/?19.*launch|9\/?19.*free/i,
  ja: /9\/?19.*無料公開|無料公開.*9\/?19/,
  "zh-CN": /9\/?19.*免费|免费.*9\/?19/,
  ko: /9\/?19.*무료|무료.*9\/?19/,
  es: /9\/?19.*gratis|gratis.*9\/?19|lanzamiento.*gratis/i,
};

const DOWNLOAD_HEADING: Record<Locale, RegExp> = {
  en: /get\s*tastile|tastile.*download/i,
  ja: /tastile\s*を入手|tastile.*ダウンロード/i,
  "zh-CN": /获取\s*Tastile|Tastile.*下载/i,
  ko: /Tastile\s*받기|Tastile.*다운로드/i,
  es: /obtener\s*tastile|tastile.*descargar/i,
};

test.describe("W06 #81 locale real-browser verification", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/pricing asserts free-only, no upgrade, no forbidden platform promises`, async ({
      page,
    }) => {
      await page.goto(`/pricing?lang=${encodeURIComponent(locale)}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        FREE_HEADING[locale],
      );

      // Free card is present.
      await expect(
        page.getByRole("heading", { name: /^free$/i }).first(),
      ).toBeVisible();

      // No paid-tier h2 (Pro / Enterprise / Premium).
      await expect(
        page.getByRole("heading", { name: /^pro$|^enterprise$|^premium$/i }),
      ).toHaveCount(0);

      // No upgrade / subscribe / checkout CTA anywhere on the page.
      for (const pattern of UPGRADE_COPY[locale]) {
        await expect(
          page.getByText(pattern),
          `locale ${locale} must not surface "${pattern}" on /pricing`,
        ).toHaveCount(0);
      }

      // No forbidden promises (Mac, iOS, Desktop sync, Offline, Unlimited, ...).
      // The /pricing page does not have a non-availability disclaimer
      // (only /download does), so a whole-body text scan is enough.
      const bodyText = await page.locator("main").innerText();
      for (const pattern of FORBIDDEN_PROMISE_PATTERNS[locale]) {
        expect(
          pattern.test(bodyText),
          `locale ${locale}: forbidden promise ${pattern} must not appear on /pricing`,
        ).toBe(false);
      }

      // No link to the legacy Windows download endpoint.
      const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLAnchorElement).getAttribute("href") ?? ""),
      );
      expect(
        hrefs.some((h) => /\/api\/download\/windows/i.test(h)),
        `locale ${locale}: /pricing must not link to /api/download/windows`,
      ).toBe(false);
    });

    test(`/${locale}/download asserts free handoff, no Windows link, no platform promise`, async ({
      page,
    }) => {
      await page.goto(`/download?lang=${encodeURIComponent(locale)}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        DOWNLOAD_HEADING[locale],
      );

      // Primary CTA links to web app / login / Google Play — never to the
      // legacy /api/download/windows binary.
      const ctas = page.locator("a[href]");
      const ctaCount = await ctas.count();
      for (let i = 0; i < ctaCount; i++) {
        const href = (await ctas.nth(i).getAttribute("href")) ?? "";
        expect(
          /\/api\/download\/windows/i.test(href),
          `locale ${locale}: download CTA #${i} href=${href} must not point to /api/download/windows`,
        ).toBe(false);
      }

      // Body copy: no forbidden promises. /download intentionally says
      // "There is no Windows or Desktop download" as a non-availability
      // disclaimer — the assertion must distinguish a disclaimer from
      // an affirmative promise. Scope to interactive elements
      // (button / link / h2-h6 headings) and the visible CTA text;
      // ignore the disclaimer paragraph.
      const interactiveText = await page
        .locator("main button, main a, main h1, main h2, main h3, main h4, main h5, main h6")
        .allInnerTexts()
        .then((arr) => arr.join("\n"));
      for (const pattern of FORBIDDEN_PROMISE_PATTERNS[locale]) {
        expect(
          pattern.test(interactiveText),
          `locale ${locale}: forbidden promise ${pattern} must not appear on /download CTAs/headings`,
        ).toBe(false);
      }
    });
  }
});
