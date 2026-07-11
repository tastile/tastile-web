import type { Locale } from "../stores/locale-store";
import { translations } from "./translations";

export function getHeaderTranslations(locale: Locale) {
  const nav = translations[locale].marketing.nav;
  return {
    features: nav.features,
    pricing: nav.pricing,
    download: nav.download,
    login: nav.login,
    getStarted: nav.getStarted,
  };
}

export function getFooterTranslations(locale: Locale) {
  const nav = translations[locale].marketing.nav;
  const footer = translations[locale].marketing.footer;
  return {
    webApp: nav.webApp,
    download: nav.download,
    pricing: nav.pricing,
    privacy: nav.privacy,
    terms: nav.terms,
    tokushoho: nav.tokushoho,
    copyright: footer.copyright,
  };
}
