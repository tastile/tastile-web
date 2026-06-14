import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollPage } from "@/components/ScrollPage";
import {
  Play,
  PenLine,
  Lightbulb,
} from "lucide-react";

const dict = {
  ja: {
    heroBadge: "実行支援ツール",
    heroTitle: ["考えるのは、", "もうやめていい。"],
    heroDesc: "やることを入れると、Tastileが時間帯まで自動で組みます。",
    heroCta1: "無料で始める",
    heroCta2: "アプリをダウンロード",

    bridgeTitle: "Tastileが、そのすべてを。",
    bridgeDesc: "やることを入れれば、期限・優先度・状態を読み取り、分単位のスケジュールに自動で落とす。",

    /* ─── how it works ─── */
    howTitle: "Tastileがやっていること",
    howPrinciples: [
      { symbol: "①", text: { ja: "1つのことを、1つの時間に。選択肢はない。", en: "One thing, one time. No choices." } },
      { symbol: "②", text: { ja: "常時監視。時間・状態・完了を観測し、自動で調整。", en: "Always watching. Time, state, completion — auto-adjusts." } },
      { symbol: "③", text: { ja: "タスクは6つの軸で定義される。期限・場所・変形・完了条件・超過時の処理。", en: "Tasks defined by 6 axes. Deadline, place, deformation, completion, overflow." } },
    ],
    howPipeline: { ja: "入力 → 編成 → 配置 → 実行 → 観測 → 調整", en: "Input → Compile → Place → Execute → Observe → Adjust" },

    stepsTitle: "サイクル",
    steps: [
      { icon: "📝", label: "書く", body: "やることを入力" },
      { icon: "→", label: "" },
      { icon: "⚡", label: "組まれる", body: "時間帯まで自動で" },
      { icon: "→", label: "" },
      { icon: "▶", label: "実行", body: "完了すれば次が届く" },
    ],

    lifeTitle: "Tastileがある生活",
    lifeLines: [
      "朝、開くと今日の全体像が見える",
      "隙間には最適なタスクが入る",
      "変更が起きれば、自動で組み直される",
      "同じ時間に同じことを繰り返す——それが習慣になる",
    ],

    pricingTitle: "無料で始められる",
    pricingBody: "主要機能はすべて無料。Proなら無制限タイル・2年分の履歴・デスクトップ同期。月$5。",

    qaTitle: "Q&A",
    qa: [
      { q: "既存のアプリと何が違う？", a: "カレンダー・時計・タスクを一つに統合。別アプリを切り替える必要がない。" },
      { q: "スケジュールが変わったら？", a: "自動で組み直される。手動修正は不要。" },
      { q: "タスクが終わらなかったら？", a: "次の空き時間に自動スケジュール。積み残しは忘れない。" },
      { q: "どんな人におすすめ？", a: "「何から始めよう」と悩む人。実行を変えたい人。" },
    ],

    ctaTitle: ["予定と、やることと、", "実行を、ひとつに。"],
    ctaBody: "Tastileが最適な順番と時間を決める。あなたは実行するだけ。",
    ctaCta1: "無料で始める",
    ctaCta2: "アプリをダウンロード",

    footerWebApp: "Webアプリ",
    footerDownload: "ダウンロード",
    footerPrivacy: "プライバシー",
    footerTerms: "利用規約",
    footerPricing: "料金",
  },
  en: {
    heroBadge: "Execution support tool",
    heroTitle: ["Stop thinking.", "Just execute."],
    heroDesc: "Add tasks, and Tastile builds your minute-level schedule automatically.",
    heroCta1: "Get Started Free",
    heroCta2: "Download App",

    bridgeTitle: "Tastile connects them all.",
    bridgeDesc: "Add a task and it reads your deadlines, priority, and energy — then builds your minute-level schedule.",
    howTitle: "What Tastile does",
    howPrinciples: [
      { symbol: "①", text: { ja: "1つのことを、1つの時間に。選択肢はない。", en: "One thing, one time. No choices." } },
      { symbol: "②", text: { ja: "常時監視。時間・状態・完了を観測し、自動で調整。", en: "Always watching. Time, state, completion — auto-adjusts." } },
      { symbol: "③", text: { ja: "タスクは6つの軸で定義される。期限・場所・変形・完了条件・超過時の処理。", en: "Tasks defined by 6 axes. Deadline, place, deformation, completion, overflow." } },
    ],
    howPipeline: { ja: "入力 → 編成 → 配置 → 実行 → 観測 → 調整", en: "Input → Compile → Place → Execute → Observe → Adjust" },

    stepsTitle: "Cycle",
    steps: [
      { icon: "📝", label: "Write", body: "Add your tasks" },
      { icon: "→", label: "" },
      { icon: "⚡", label: "Scheduled", body: "Auto-fitted to time" },
      { icon: "→", label: "" },
      { icon: "▶", label: "Execute", body: "Done? Next one arrives" },
    ],

    lifeTitle: "Life with Tastile",
    lifeLines: [
      "Open it in the morning — your day is laid out",
      "Gaps get filled with the right task",
      "Changes trigger an automatic rebuild",
      "Same time, same task — that's how habits form",
    ],

    pricingTitle: "Start free",
    pricingBody: "All core features free. Pro: unlimited tiles, 2-year history, desktop sync. $5/mo.",

    qaTitle: "Q&A",
    qa: [
      { q: "How is it different?", a: "Calendar, clock, and tasks in one app. No switching." },
      { q: "Schedule changes?", a: "Automatic rebuild. No manual edits." },
      { q: "Unfinished tasks?", a: "Auto-rescheduled. Nothing gets forgotten." },
      { q: "Who is this for?", a: "People who want to stop planning and start executing." },
    ],

    ctaTitle: ["Schedules, tasks,", "and execution.", "Connected."],
    ctaBody: "Tastile decides the order and timing. You just execute.",
    ctaCta1: "Get Started Free",
    ctaCta2: "Download App",

    footerWebApp: "Web App",
    footerDownload: "Download",
    footerPrivacy: "Privacy",
    footerTerms: "Terms",
    footerPricing: "Pricing",
  },
} as const;

const stepIcons = [
  <PenLine key="1" className="w-5 h-5" />,
  <Lightbulb key="2" className="w-5 h-5" />,
  <Play key="3" className="w-5 h-5" />,
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = params.lang === "en" ? "en" : "ja";
  const t = dict[lang];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader showFeatureLink />
      <ScrollPage t={t} stepIcons={stepIcons} lang={lang} />
      <SiteFooter />
    </div>
  );
}
