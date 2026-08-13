import type { Locale } from "@/shared/stores/locale-store";
import { activityBar } from "./sections/app/activityBar";
import { common } from "./sections/app/common";
import { floatingHeader } from "./sections/app/floatingHeader";
import { header } from "./sections/app/header";
import { language } from "./sections/app/language";
import { languageToggle } from "./sections/app/languageToggle";
import { nav } from "./sections/app/nav";
import { shell } from "./sections/app/shell";
import { sidebar } from "./sections/app/sidebar";
import { calendar } from "./sections/features/calendar";
import { createTile } from "./sections/features/createTile";
import { dashboard } from "./sections/features/dashboard";
import { projects } from "./sections/features/projects";
import {
  quickCreateEn,
  quickCreateEs,
  quickCreateJa,
  quickCreateKo,
  quickCreateZhCn,
} from "./sections/features/quickcreate";
import { schedule } from "./sections/features/schedule";
import { tasks } from "./sections/features/tasks";
import { tiles } from "./sections/features/tiles";
import { timeline } from "./sections/features/timeline";
import {
  marketingEn,
  marketingEs,
  marketingJa,
  marketingKo,
  marketingZhCn,
} from "./sections/marketing/marketing";
import {
  marketingLandingEn,
  marketingLandingJa,
} from "./sections/marketing/marketingLanding";
import { account } from "./sections/system/account";
import { auth } from "./sections/system/auth";
import { execution } from "./sections/system/execution";
import { notifications } from "./sections/system/notifications";
import { preferences } from "./sections/system/preferences";
import { prompt } from "./sections/system/prompt";
import { settings } from "./sections/system/settings";

type Dict = Record<string, unknown>;

// Deep-merge plain-object trees so multiple sections can contribute to the
// same namespace (e.g. calendar / tasks / schedule / projects all sit under
// `panels.<name>` in the legacy tree).
function deepMerge(...sources: Dict[]): Dict {
  const out: Dict = {};
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const key of Object.keys(src)) {
      const a = out[key];
      const b = src[key];
      if (a && typeof a === "object" && b && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
        out[key] = deepMerge(a as Dict, b as Dict);
      } else if (b !== undefined) {
        out[key] = b;
      }
    }
  }
  return out;
}

const sections = [
  account,
  auth,
  calendar,
  common,
  dashboard,
  execution,
  language,
  notifications,
  preferences,
  prompt,
  projects,
  schedule,
  settings,
  shell,
  nav,
  header,
  sidebar,
  activityBar,
  floatingHeader,
  languageToggle,
  tasks,
  tiles,
  timeline,
] as const;

const localeList = ["en", "ja", "zh-CN", "ko", "es"] as Locale[];

const quickCreate = {
  en: quickCreateEn,
  ja: quickCreateJa,
  "zh-CN": quickCreateZhCn,
  ko: quickCreateKo,
  es: quickCreateEs,
} as const;

const marketing = {
  en: marketingEn,
  ja: marketingJa,
  "zh-CN": marketingZhCn,
  ko: marketingKo,
  es: marketingEs,
} as const;

// landing-page copy only ships for en/ja; other locales fall through to en.
const marketingLanding = {
  en: marketingLandingEn,
  ja: marketingLandingJa,
} as const;

export const translations = Object.fromEntries(
  localeList.map((loc) => {
    const sectionTree = sections.map((s) => s[loc] as Dict);
    const qc = quickCreate[loc] as Dict;
    const mkt = marketing[loc] as Dict;
    // landing-page copy only ships for en/ja; other locales don't carry a
    // marketingLanding block, so consumers fall through to en via the
    // useTranslation() FALLBACK_LOCALE contract.
    const extras: Dict[] = [{ quickCreate: qc }, { marketing: mkt }, { createTile: createTile[loc] as Dict }];
    if ((loc as keyof typeof marketingLanding) in marketingLanding) {
      extras.push({ marketingLanding: marketingLanding[loc as keyof typeof marketingLanding] as Dict });
    }
    return [loc, deepMerge(...sectionTree, ...extras)];
  }),
) as Record<Locale, Record<string, unknown>>;
