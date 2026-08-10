export const marketingJa = {
  nav: {
    features: "機能",
    pricing: "料金",
    download: "ダウンロード",
    login: "ログイン",
    getStarted: "無料で始める",
    webApp: "Webアプリ",
    privacy: "プライバシー",
    terms: "利用規約",
    tokushoho: "特定商取引法に基づく表記",
  },
  pricing: {
    title: "シンプルで透明な料金体系",
    subtitle: "無料で始められます。もっと必要になったらアップグレード。",
    freePlan: "Free",
    freeDesc: "個人の実行制御のために",
    proPlan: "Pro",
    proDesc: "本格的な実行制御のために",
    popular: "人気",
    monthly: "月額",
    yearly: "年額",
    yearlySave: "17%お得",
    perMonth: "/月",
    perYear: "/年",
    getStarted: "無料で始める",
    upgrade: "Proにアップグレード",
    loading: "読み込み中...",
    freeFeatures: [
      { title: "100ローカルタイル", desc: "デバイスに保存" },
      { title: "50クラウドタイル", desc: "デバイス間で同期" },
      { title: "30日分の履歴", desc: "実行追跡" },
      { title: "Webアプリ", desc: "ステータス、プロンプト、メモ" },
    ],
    proFeatures: [
      { title: "10,000タイル", desc: "ローカル＋クラウド保存" },
      { title: "2年分の履歴", desc: "長期追跡" },
      { title: "100,000イベント", desc: "詳細な実行ログ" },
      { title: "デスクトップ同期", desc: "Windowsアプリ連携" },
      { title: "フルダッシュボード", desc: "分析とインサイト" },
      { title: "条件編集", desc: "高度なタイル設定" },
    ],
  },
  download: {
    title: "Tastileをダウンロード",
    subtitle: "デスクトップアプリで最高の実行制御体験を。",
    downloadButton: "Windows版をダウンロード（64ビット）",
    version: "バージョン",
    alsoAvailable: "その他利用可能",
    microsoftStore: "Microsoft Store",
    comingSoon: "近日Microsoft Storeに登場",
    systemRequirements: "システム要件",
    requirements: [
      "Windows 10 バージョン 19041.0 以上",
      "Windows 11 対応",
      "x64 アーキテクチャ",
      "同期機能にはインターネット接続が必要",
    ],
    webAlternative: "または、ダウンロードなしでTastileをWebで使えます。",
    openWebApp: "Webアプリを開く",
  },
  footer: {
    copyright: "© 2026 Tastile. All rights reserved.",
  },
};

export const marketingEn = {
  nav: {
    features: "Features",
    pricing: "Pricing",
    download: "Download",
    login: "Log in",
    getStarted: "Get Started Free",
    webApp: "Web App",
    privacy: "Privacy",
    terms: "Terms",
    tokushoho: "Commerce Disclosure",
  },
  pricing: {
    title: "Simple, transparent pricing",
    subtitle: "Start free, upgrade when you need more power.",
    freePlan: "Free",
    freeDesc: "For personal execution control",
    proPlan: "Pro",
    proDesc: "For serious execution control",
    popular: "POPULAR",
    monthly: "Monthly",
    yearly: "Yearly",
    yearlySave: "save 17%",
    perMonth: "/month",
    perYear: "/year",
    getStarted: "Get Started Free",
    upgrade: "Upgrade to Pro",
    loading: "Loading...",
    freeFeatures: [
      { title: "100 local tiles", desc: "Stored on your device" },
      { title: "50 cloud tiles", desc: "Sync across devices" },
      { title: "30 day history", desc: "Execution tracking" },
      { title: "Web app", desc: "Status, prompt, memo" },
    ],
    proFeatures: [
      { title: "10,000 tiles", desc: "Local + cloud storage" },
      { title: "2 year history", desc: "Long-term tracking" },
      { title: "100,000 events", desc: "Detailed execution log" },
      { title: "Desktop sync", desc: "Windows app integration" },
      { title: "Full dashboard", desc: "Analytics and insights" },
      { title: "Condition editing", desc: "Advanced tile configuration" },
    ],
  },
  download: {
    title: "Download Tastile for Windows",
    subtitle: "Get the desktop app for the best execution control experience.",
    downloadButton: "Download for Windows (64-bit)",
    version: "Version",
    alsoAvailable: "Also available on",
    microsoftStore: "Microsoft Store",
    comingSoon: "Coming soon to Microsoft Store",
    systemRequirements: "System Requirements",
    requirements: [
      "Windows 10 version 19041.0 or higher",
      "Windows 11 supported",
      "x64 architecture",
      "Internet connection for sync features",
    ],
    webAlternative: "Or use Tastile on the web — no download required.",
    openWebApp: "Open Web App",
  },
  footer: {
    copyright: "© 2026 Tastile. All rights reserved.",
  },
};

// Skeleton marketing entries for the 3 new locales (zh-CN / ko / es).
// Only the language-picker display names are populated; every other key
// falls back to the English tree via the translations store. Mirrors the
// `en` / `ja` entries in this file.
export const marketingZhCn = {
  settings: { language: "语言" },
  language: {
    "zh-CN": "中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
    es: "Español",
  },
};

export const marketingKo = {
  settings: { language: "언어" },
  language: {
    "zh-CN": "中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
    es: "Español",
  },
};

export const marketingEs = {
  settings: { language: "Idioma" },
  language: {
    "zh-CN": "中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
    es: "Español",
  },
};
