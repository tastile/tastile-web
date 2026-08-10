import type { Locale } from "@/shared/stores/locale-store";

export const settings = {
  en: {
    settings: {
      title: "Settings",
      theme: "Color Theme",
      language: "Language",
      themeLight: "Light",
      themeGray: "Gray",
      themeDark: "Dark",
      languageJa: "日本語",
      languageEn: "English",
      network: "Network",
      directModeLabel: "Connect directly to daemon from browser (experimental)",
      directModeDescription:
        "Speeds up page rendering, but may fail in some browsers depending on the Cookie SameSite setting",
      directModeSaved: "Saved",
      directModeSaveFailed: "Failed to save",
      weekStart: "Week Start Day",
      weekStartSunday: "Sunday",
      weekStartMonday: "Monday",
    },
  },
  ja: {
    settings: {
      title: "設定",
      theme: "カラーテーマ",
      language: "言語",
      themeLight: "ライト",
      themeGray: "グレー",
      themeDark: "ダーク",
      languageJa: "日本語",
      languageEn: "English",
      network: "ネットワーク",
      directModeLabel: "ブラウザから直接 daemon に接続 (実験的)",
      directModeDescription:
        "有効にするとページ表示が速くなりますが、Cookie の SameSite 設定によっては一部ブラウザで失敗します",
      directModeSaved: "保存しました",
      directModeSaveFailed: "保存に失敗しました",
      weekStart: "週の開始日",
      weekStartSunday: "日曜日",
      weekStartMonday: "月曜日",
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
