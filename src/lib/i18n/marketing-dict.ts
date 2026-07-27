import type { Locale } from "@/lib/stores/locale-store";
import { translations } from "./translations";

// The translations record is typed loosely (Dict = Record<string, unknown>) at
// the call sites that read nested data, matching the existing pattern in
// server-translations.ts and use-translation.ts. We apply the same cast here
// so reading `marketingLanding` works without re-typing the whole tree.
type RawDict = Record<string, unknown>;

// Legacy alias kept for back-compat with the 7 marketing components and
// page.tsx, which still address the landing page dictionary by a "ja" | "en"
// selector sourced from the `?lang=` query param.
export type Lang = "ja" | "en";

// Shape consumed by the 7 marketing components and LandingPage.tsx.
// Mirrors the legacy `Dict` interface from the pre-translation landing page
// dictionary so callers do not need to change.
export type Dict = {
  hero: {
    badge: string;
    title: [string, string];
    sub: string;
    context: string;
    pierceText: string;
    ctaPrimary: string;
    ctaSecondary: string;
    ctaPrimaryHref: string;
    ctaSecondaryHref: string;
    previewActiveLabel: string;
    previewTiles: Array<{
      time: string;
      duration: string;
      title: string;
      place: string;
      state: "active" | "done" | "queued";
    }>;
    previewNextLabel: string;
    previewNextAt: string;
    previewNextAction: string;
    previewTodayLabel: string;
    previewAxisLabels: string[];
  };
  bento: {
    eyebrow: string;
    title: string;
    intro: string;
    lead: string;
    axisLabel: string;
    exampleLabel: string;
    rows: Array<{ numeral: string; name: string; lede: string; body: string; example: string }>;
  };
  lifecycle: {
    eyebrow: string;
    title: string;
    intro: string;
    lead: string;
    phases: string[];
    phaseDetails: Array<{ title: string; description: string }>;
    activeLabel: string;
  };
  manifesto: {
    eyebrow: string;
    title: [string, string];
    lead: string;
    leftLabel: string;
    leftItems: string[];
    rightLabel: string;
    rightHeadline: string;
    rightSubtext: string;
    timelineTitle: string;
    timelineSubtitle: string;
    timelineKindLabel: string;
    timelineLiveTitle: string;
    timeline: Array<{
      time: string;
      title: string;
      note: string;
      kind: "tile" | "adjust" | "overflow" | "break";
    }>;
  };
  pricing: {
    eyebrow: string;
    title: [string, string];
    intro: string;
    monthly: string;
    yearly: string;
    yearlyNote: string;
    forLabel: string;
    free: {
      name: string;
      price: string;
      tagline: string;
      cta: string;
      features: Array<{ title: string; detail: string }>;
      footnote: string;
    };
    pro: {
      name: string;
      badge: string;
      tagline: string;
      cta: string;
      features: Array<{ title: string; detail: string }>;
      footnote: string;
    };
  };
  faq: {
    eyebrow: string;
    title: string;
    intro: string;
    countSuffix: string;
    items: Array<{ q: string; a: string }>;
  };
  finalCta: {
    startHereLabel: string;
    pierceText: string;
    title: [string, string];
    note: string;
    promise: string[];
    ctaPrimary: string;
    ctaSecondary: string;
    freeTierNote: string;
    cancelNote: string;
    platformNote: string;
  };
};

// The flat marketingLanding section inside translations.ts (ja / en).
// Using `en` as the structural reference because both locales share the same
// key shape; the ja section is a strict superset of the en keys (en may lack
// some ja-only additions).
type FlatMarketingLanding = RawDict;

const PREVIEW_TILE_COUNT = 4;
const BENTO_ROW_COUNT = 6;
const LIFECYCLE_PHASE_COUNT = 6;
const LIFECYCLE_DETAIL_COUNT = 6;
const MANIFESTO_LEFT_ITEM_COUNT = 6;
const MANIFESTO_TIMELINE_COUNT = 7;
const PRICING_FEATURE_COUNT = 4;
const FAQ_ITEM_COUNT = 8;
const FINAL_CTA_PROMISE_COUNT = 3;

// Reshape the flat `marketingLanding` section into the structured `Dict` that
// the 7 marketing components consume. The Dict shape only has content for ja
// and en, so non-ja/non-en locales fall back to en via the translations store.
function reshape(flat: FlatMarketingLanding): Dict {
  const hero = flat.hero as RawDict;
  const bento = flat.bento as RawDict;
  const lifecycle = flat.lifecycle as RawDict;
  const manifesto = flat.manifesto as RawDict;
  const pricing = flat.pricing as RawDict;
  const faq = flat.faq as RawDict;
  const finalCta = flat.finalCta as RawDict;

  function pickString(section: RawDict, key: string): string {
    const v = section[key];
    return typeof v === "string" ? v : "";
  }

  // Hero
  const previewTiles: Dict["hero"]["previewTiles"] = [];
  for (let i = 0; i < PREVIEW_TILE_COUNT; i += 1) {
    const time = pickString(hero, `previewTile${i}Time`);
    const duration = pickString(hero, `previewTile${i}Duration`);
    const title = pickString(hero, `previewTile${i}Title`);
    const place = pickString(hero, `previewTile${i}Place`);
    if (!time || !duration || !title || !place) {
      // Each preview tile slot is required; skip sparse entries so the
      // landing page still renders with whatever count is fully populated.
      continue;
    }
    previewTiles.push({
      time,
      duration,
      title,
      place,
      state: i === 0 ? "active" : "queued",
    });
  }

  // Bento rows
  const bentoRows: Dict["bento"]["rows"] = [];
  for (let i = 0; i < BENTO_ROW_COUNT; i += 1) {
    const name = pickString(bento, `row${i}Name`);
    const lede = pickString(bento, `row${i}Lede`);
    const body = pickString(bento, `row${i}Body`);
    const example = pickString(bento, `row${i}Example`);
    if (!name || !lede || !body || !example) {
      continue;
    }
    bentoRows.push({
      numeral: i < 9 ? `0${i + 1}` : `${i + 1}`,
      name,
      lede,
      body,
      example,
    });
  }

  // Lifecycle phases + details
  const phases: string[] = [];
  for (let i = 0; i < LIFECYCLE_PHASE_COUNT; i += 1) {
    const phase = pickString(lifecycle, `phase${i}`);
    if (phase) {
      phases.push(phase);
    }
  }
  const phaseDetails: Dict["lifecycle"]["phaseDetails"] = [];
  for (let i = 0; i < LIFECYCLE_DETAIL_COUNT; i += 1) {
    const title = pickString(lifecycle, `phaseDetail${i}Title`);
    const description = pickString(lifecycle, `phaseDetail${i}Description`);
    if (title && description) {
      phaseDetails.push({ title, description });
    }
  }

  // Manifesto leftItems + timeline
  const leftItems: string[] = [];
  for (let i = 0; i < MANIFESTO_LEFT_ITEM_COUNT; i += 1) {
    const item = pickString(manifesto, `leftItem${i}`);
    if (item) {
      leftItems.push(item);
    }
  }
  // Kind tags follow the order in the original landing page dictionary:
  // tile, adjust, tile, overflow, break, tile, adjust. Encoded as a static
  // list so the timeline component receives a known categorical `kind` value.
  const timelineKinds: Array<"tile" | "adjust" | "overflow" | "break"> = [
    "tile",
    "adjust",
    "tile",
    "overflow",
    "break",
    "tile",
    "adjust",
  ];
  const timeline: Dict["manifesto"]["timeline"] = [];
  for (let i = 0; i < MANIFESTO_TIMELINE_COUNT; i += 1) {
    const time = pickString(manifesto, `timeline${i}Time`);
    const title = pickString(manifesto, `timeline${i}Title`);
    const note = pickString(manifesto, `timeline${i}Note`);
    if (!time || !title || !note) {
      continue;
    }
    timeline.push({
      time,
      title,
      note,
      kind: timelineKinds[i] ?? "tile",
    });
  }

  // Pricing features
  function buildFeatures(prefix: "free" | "pro"): Array<{ title: string; detail: string }> {
    const out: Array<{ title: string; detail: string }> = [];
    for (let i = 0; i < PRICING_FEATURE_COUNT; i += 1) {
      const title = pickString(pricing, `${prefix}Feature${i}Title`);
      const detail = pickString(pricing, `${prefix}Feature${i}Detail`);
      if (title && detail) {
        out.push({ title, detail });
      }
    }
    return out;
  }

  // FAQ items
  const faqItems: Dict["faq"]["items"] = [];
  for (let i = 0; i < FAQ_ITEM_COUNT; i += 1) {
    const q = pickString(faq, `q${i}`);
    const a = pickString(faq, `a${i}`);
    if (q && a) {
      faqItems.push({ q, a });
    }
  }

  // finalCta.promise
  const promise: string[] = [];
  for (let i = 0; i < FINAL_CTA_PROMISE_COUNT; i += 1) {
    const p = pickString(finalCta, `promise${i}`);
    if (p) {
      promise.push(p);
    }
  }

  return {
    hero: {
      badge: pickString(hero, "badge"),
      title: [pickString(hero, "title0"), pickString(hero, "title1")],
      sub: pickString(hero, "sub"),
      context: pickString(hero, "context"),
      pierceText: pickString(hero, "pierceText"),
      ctaPrimary: pickString(hero, "ctaPrimary"),
      ctaSecondary: pickString(hero, "ctaSecondary"),
      // The CTA hrefs are routing targets, not copy. They are stable across
      // locales and live in the codebase rather than translations.
      ctaPrimaryHref: "/login",
      ctaSecondaryHref: "/download",
      previewActiveLabel: pickString(hero, "previewActiveLabel"),
      previewTiles,
      previewNextLabel: pickString(hero, "previewNextLabel"),
      previewNextAt: pickString(hero, "previewNextAt"),
      previewNextAction: pickString(hero, "previewNextAction"),
      previewTodayLabel: pickString(hero, "previewTodayLabel"),
      previewAxisLabels: [
        pickString(hero, "previewAxis0"),
        pickString(hero, "previewAxis1"),
        pickString(hero, "previewAxis2"),
        pickString(hero, "previewAxis3"),
        pickString(hero, "previewAxis4"),
        pickString(hero, "previewAxis5"),
      ],
    },
    bento: {
      eyebrow: pickString(bento, "eyebrow"),
      title: pickString(bento, "title"),
      intro: pickString(bento, "intro"),
      lead: pickString(bento, "lead"),
      axisLabel: pickString(bento, "axisLabel"),
      exampleLabel: pickString(bento, "exampleLabel"),
      rows: bentoRows,
    },
    lifecycle: {
      eyebrow: pickString(lifecycle, "eyebrow"),
      title: pickString(lifecycle, "title"),
      intro: pickString(lifecycle, "intro"),
      lead: pickString(lifecycle, "lead"),
      phases,
      phaseDetails,
      activeLabel: pickString(lifecycle, "activeLabel"),
    },
    manifesto: {
      eyebrow: pickString(manifesto, "eyebrow"),
      title: [pickString(manifesto, "title0"), pickString(manifesto, "title1")],
      lead: pickString(manifesto, "lead"),
      leftLabel: pickString(manifesto, "leftLabel"),
      leftItems,
      rightLabel: pickString(manifesto, "rightLabel"),
      rightHeadline: pickString(manifesto, "rightHeadline"),
      rightSubtext: pickString(manifesto, "rightSubtext"),
      timelineTitle: pickString(manifesto, "timelineTitle"),
      timelineSubtitle: pickString(manifesto, "timelineSubtitle"),
      timelineKindLabel: pickString(manifesto, "timelineKindLabel"),
      timelineLiveTitle: pickString(manifesto, "timelineLiveTitle"),
      timeline,
    },
    pricing: {
      eyebrow: pickString(pricing, "eyebrow"),
      title: [pickString(pricing, "title0"), pickString(pricing, "title1")],
      intro: pickString(pricing, "intro"),
      monthly: pickString(pricing, "monthly"),
      yearly: pickString(pricing, "yearly"),
      yearlyNote: pickString(pricing, "yearlyNote"),
      forLabel: pickString(pricing, "forLabel"),
      free: {
        name: pickString(pricing, "freeName"),
        price: pickString(pricing, "freePrice"),
        tagline: pickString(pricing, "freeTagline"),
        cta: pickString(pricing, "freeCta"),
        features: buildFeatures("free"),
        footnote: pickString(pricing, "freeFootnote"),
      },
      pro: {
        name: pickString(pricing, "proName"),
        badge: pickString(pricing, "proBadge"),
        tagline: pickString(pricing, "proTagline"),
        cta: pickString(pricing, "proCta"),
        features: buildFeatures("pro"),
        footnote: pickString(pricing, "proFootnote"),
      },
    },
    faq: {
      eyebrow: pickString(faq, "eyebrow"),
      title: pickString(faq, "title"),
      intro: pickString(faq, "intro"),
      countSuffix: pickString(faq, "countSuffix"),
      items: faqItems,
    },
    finalCta: {
      startHereLabel: pickString(finalCta, "startHereLabel"),
      pierceText: pickString(finalCta, "pierceText"),
      title: [pickString(finalCta, "title0"), pickString(finalCta, "title1")],
      note: pickString(finalCta, "note"),
      promise,
      ctaPrimary: pickString(finalCta, "ctaPrimary"),
      ctaSecondary: pickString(finalCta, "ctaSecondary"),
      freeTierNote: pickString(finalCta, "freeTierNote"),
      cancelNote: pickString(finalCta, "cancelNote"),
      platformNote: pickString(finalCta, "platformNote"),
    },
  };
}

// Return the marketing landing Dict for the given Locale. The `marketingLanding`
// section currently exists only for ja and en; the translations store falls
// back to en for every other locale, so this function does the same.
export function getMarketingDict(locale: Locale): Dict {
  const translationsRecord = translations as unknown as Record<Locale, RawDict>;
  const flat =
    locale === "ja" || locale === "en"
      ? translationsRecord[locale].marketingLanding
      : translationsRecord.en.marketingLanding;
  return reshape(flat as FlatMarketingLanding);
}

export type { Locale };
