import Link from "next/link";
import {
  LayoutGrid,
  Crosshair,
  BellRing,
  ListPlus,
  CalendarRange,
  CircleCheck,
  Check,
} from "lucide-react";
import { ThemeToggle, LanguageToggle } from "@/components/NavControls";
import { TastileLogo } from "@/components/TastileLogo";
import { Suspense } from "react";

const dict = {
  ja: {
    navFeatures: "機能",
    navPricing: "料金",
    navDownload: "ダウンロード",
    navLogin: "ログイン",
    navCta: "無料で始める",
    heroBadge: "Auto-scheduling execution",
    heroTitle: ["タスクを入れる。", "あとは、", "任せてください。"],
    heroBody: "次に何をすべきか、もう自分で考えなくていい。Tastileはタスクの優先順位・期限・あなたの状態を読み取り、最適なタイルをJITで自動選択します。あなたはただ、実行するだけ。",
    heroCta1: "無料で始める",
    heroCta2: "アプリをダウンロード",
    demoLabel: "Now executing",
    demoActive: "競合調査レポートをまとめる",
    demoActiveMeta: "期限: 今日 17:00 · 優先度: 高",
    demoTiles: [
      { label: "週次レビューのスライド作成", due: "明日 10:00" },
      { label: "バックログの整理", due: "今週中" },
    ],
    demoTileDuePrefix: "期限: ",
    pillarsTitle: "これがTastile独自のアプローチです",
    pillarsBody: "よくあるタスク管理と根本から違う。タスクを整理するためではなく、実行するために設計されています。",
    pillars: [
      { title: "自動でスケジュールを組む", body: "タスクを登録するだけで、Tastileが締め切り・優先度・あなたのエネルギー状態を総合的に判断し、今やるべきタイルを自動的に決めます。毎朝の計画作業が不要になります。" },
      { title: "今やることをひとつだけ教えてくれる", body: "複数のタスクを同時に表示しない。システムが選んだひとつのタイルだけにフォーカス。並行作業による集中力の分散を防ぎ、実行の質を高めます。次は何をすべきか、迷う時間はゼロ。" },
      { title: "脱線したら、引き戻してくれる", body: "作業時間が過ぎてもタイルを完了しないとシステムが介入します。「まだやってる？」「次に進む？」という確認ダイアログで、無意識のドリフトに気づかせてくれます。" },
    ],
    stepsTitle: "3ステップで始められます",
    stepsBody: "セットアップは数分。複雑な設定は一切不要です。",
    steps: [
      { title: "タスクを登録する", body: "やりたいこと・やらなければいけないことをタイルとして入力します。期限や大まかな優先度だけ設定すればOK。細かいスケジュールは不要です。" },
      { title: "システムが次のタイルを選ぶ", body: "あなたが登録したタイルをTastileが自動でスコアリング。優先順位・締め切り・推定作業時間・あなたのエネルギーレベルをもとに、今すべき1枚を自動で選択します。" },
      { title: "実行して、完了にするだけ", body: "提示されたタイルを開始し、作業し、完了にする。それだけです。次に何をすべきかはTastileが考えます。あなたは「実行」に集中できます。" },
    ],
    pricingTitle: "まずは無料で始めよう",
    pricingBody: "クレジットカード不要。無料プランでも主要機能はすべて使えます。",
    freeLabel: "無料",
    freeSub: "ずっと無料、クレジットカード不要",
    freeFeatures: ["タスク登録・自動スケジューリング", "最大50タイル（クラウド）", "30日間の実行履歴", "iOS PWAアプリ対応"],
    freeCta: "無料で始める",
    proPrice: "$5",
    proPer: "/月",
    proSub: "年払いで $50/年（2ヶ月分お得）",
    proFeatures: ["無制限タイル + 10,000クラウドタイル", "2年間の実行履歴・分析", "デスクトップアプリ同期", "フルダッシュボード・統計", "優先サポート"],
    proCta: "Proにアップグレード",
    ctaTitle: ["今日のタスク、", "もう迷わなくていい。"],
    ctaBody: "Tastileがあなたの代わりに考えます。あなたはただ、実行するだけ。",
    ctaCta1: "無料で始める",
    ctaCta2: "アプリをダウンロード",
    footerWebApp: "Webアプリ",
    footerDownload: "ダウンロード",
    footerPrivacy: "プライバシー",
    footerTerms: "利用規約",
    footerPricing: "料金",
  },
  en: {
    navFeatures: "Features",
    navPricing: "Pricing",
    navDownload: "Download",
    navLogin: "Log In",
    navCta: "Get Started Free",
    heroBadge: "Auto-scheduling execution",
    heroTitle: ["Add your tasks.", "The rest is", "on us."],
    heroBody: "Stop deciding what to do next. Tastile reads your priorities, deadlines, and energy — then picks the optimal tile for you. You just execute.",
    heroCta1: "Get Started Free",
    heroCta2: "Download App",
    demoLabel: "Now executing",
    demoActive: "Compile competitive research report",
    demoActiveMeta: "Due: Today 17:00 · Priority: High",
    demoTiles: [
      { label: "Create weekly review slides", due: "Tomorrow 10:00" },
      { label: "Clean up backlog", due: "This week" },
    ],
    demoTileDuePrefix: "Due: ",
    pillarsTitle: "The Tastile approach",
    pillarsBody: "Not another task manager. Designed for execution, not organization.",
    pillars: [
      { title: "Auto-schedule your day", body: "Just add tasks. Tastile evaluates deadlines, priority, and your energy level to decide what you should do right now. No morning planning needed." },
      { title: "One tile at a time", body: "No multi-task views. The system picks one tile for you to focus on. Zero decision fatigue, maximum execution quality." },
      { title: "Pulls you back on track", body: "If you drift past a tile's time, the system intervenes. A simple prompt asks: still going? Move on? It catches unconscious drift." },
    ],
    stepsTitle: "3 steps to get started",
    stepsBody: "Setup takes minutes. No complex configuration needed.",
    steps: [
      { title: "Add your tasks", body: "Enter what you need to do as tiles. Set rough priority and deadline — that's it. No detailed scheduling required." },
      { title: "System picks your next tile", body: "Tastile auto-scores your tiles based on priority, deadline, estimated time, and your energy level, then selects the one you should do now." },
      { title: "Execute and complete", body: "Start the tile, do the work, mark it done. That's all. Tastile figures out what's next. You focus on execution." },
    ],
    pricingTitle: "Start free, upgrade when ready",
    pricingBody: "No credit card required. All core features available on the free plan.",
    freeLabel: "Free",
    freeSub: "Free forever, no credit card",
    freeFeatures: ["Task creation & auto-scheduling", "Up to 50 cloud tiles", "30-day execution history", "iOS PWA support"],
    freeCta: "Get Started Free",
    proPrice: "$5",
    proPer: "/mo",
    proSub: "Annual billing: $50/yr (save 2 months)",
    proFeatures: ["Unlimited tiles + 10,000 cloud tiles", "2-year execution history & analytics", "Desktop app sync", "Full dashboard & stats", "Priority support"],
    proCta: "Upgrade to Pro",
    ctaTitle: ["Today's tasks?", "No more guessing."],
    ctaBody: "Tastile thinks so you don't have to. You just execute.",
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
  <ListPlus key="1" className="w-5 h-5" />,
  <CalendarRange key="2" className="w-5 h-5" />,
  <CircleCheck key="3" className="w-5 h-5" />,
];

const pillarIcons = [
  <LayoutGrid key="1" className="w-6 h-6" />,
  <Crosshair key="2" className="w-6 h-6" />,
  <BellRing key="3" className="w-6 h-6" />,
];

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const lang = params.lang === 'en' ? 'en' : 'ja';
  const t = dict[lang];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <TastileLogo size={22} className="text-zinc-900 dark:text-zinc-100" />
            <span className="font-bold text-lg tracking-tight">tastile</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="#features" className="hidden sm:block px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {t.navFeatures}
            </Link>
            <Link href="/pricing" className="hidden sm:block px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {t.navPricing}
            </Link>
            <Link href="/download" className="hidden sm:block px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {t.navDownload}
            </Link>
            <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1 hidden sm:block" />
            <Suspense fallback={null}>
              <LanguageToggle />
            </Suspense>
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:block px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              {t.navLogin}
            </Link>
            <Link
              href="/login"
              className="ml-1 px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              {t.navCta}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-24 flex flex-col lg:flex-row items-start gap-16">
        <div className="flex-none lg:w-[560px]">
          <span className="inline-block mb-6 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400 tracking-widest uppercase">
            {t.heroBadge}
          </span>
          <h1 className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-100">
            {t.heroTitle.map((line, i) => (
              <span key={i}>{line}{i < t.heroTitle.length - 1 && <br />}</span>
            ))}
          </h1>
          <p className="mt-8 text-lg leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-[480px]">
            {t.heroBody}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/login" className="px-6 py-3 rounded-md bg-zinc-900 dark:bg-zinc-100 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors">
              {t.heroCta1}
            </Link>
            <Link href="/download" className="px-6 py-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              {t.heroCta2}
            </Link>
          </div>
        </div>

        {/* Demo card */}
        <div className="flex-1 w-full">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4">{t.demoLabel}</p>
            <div className="rounded-xl bg-zinc-900 dark:bg-white p-5 flex items-start gap-4">
              <span className="mt-1 w-2 h-2 rounded-full bg-green-500 flex-none" />
              <div>
                <p className="text-sm font-semibold text-white dark:text-zinc-900">{t.demoActive}</p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{t.demoActiveMeta}</p>
              </div>
            </div>
            {t.demoTiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex items-start gap-4 opacity-50">
                <span className="mt-1 w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-none" />
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tile.label}</p>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{t.demoTileDuePrefix}{tile.due}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section id="features" className="bg-zinc-50 dark:bg-zinc-900 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">{t.pillarsTitle}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-12 max-w-xl">{t.pillarsBody}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {t.pillars.map((item, i) => (
              <div key={item.title} className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8">
                <div className="text-zinc-700 dark:text-zinc-300 mb-4">{pillarIcons[i]}</div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">{item.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">{t.stepsTitle}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-16 max-w-xl">{t.stepsBody}</p>
          <div className="space-y-0">
            {t.steps.map((step, i, arr) => (
              <div key={i}>
                <div className="flex items-start gap-8 py-10">
                  <div className="flex-none flex items-center justify-center w-14 h-14 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-sm tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400 dark:text-zinc-500">{stepIcons[i]}</div>
                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 mb-2">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-xl">{step.body}</p>
                  </div>
                </div>
                {i < arr.length - 1 && <div className="border-b border-zinc-100 dark:border-zinc-800" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-zinc-50 dark:bg-zinc-900 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t.pricingTitle}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-12">{t.pricingBody}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t.freeLabel}</span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">{t.freeSub}</p>
              <ul className="space-y-3 mb-10">
                {t.freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <Check className="w-4 h-4 text-green-500 flex-none mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="block w-full py-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                {t.freeCta}
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-100 p-8">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold text-white dark:text-zinc-900">Pro</span>
                <span className="text-lg text-zinc-300 dark:text-zinc-600">{t.proPrice}</span>
                <span className="text-sm text-zinc-400 dark:text-zinc-500">{t.proPer}</span>
              </div>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-8">{t.proSub}</p>
              <ul className="space-y-3 mb-10">
                {t.proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-zinc-300 dark:text-zinc-700">
                    <Check className="w-4 h-4 text-green-400 dark:text-green-600 flex-none mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/pricing" className="block w-full py-3 rounded-md bg-white dark:bg-zinc-900 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                {t.proCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-zinc-900 dark:bg-zinc-950 py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
            {t.ctaTitle.map((line, i) => (
              <span key={i}>{line}{i < t.ctaTitle.length - 1 && <br />}</span>
            ))}
          </h2>
          <p className="mt-6 text-zinc-400 text-lg">{t.ctaBody}</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login" className="px-8 py-3 rounded-md bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors">
              {t.ctaCta1}
            </Link>
            <Link href="/download" className="px-8 py-3 rounded-md border border-zinc-700 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors">
              {t.ctaCta2}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-10 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row justify-between items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <TastileLogo size={18} className="text-zinc-900 dark:text-zinc-100" />
            <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">tastile</span>
          </Link>
          <div className="flex gap-6 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{t.footerWebApp}</Link>
            <Link href="/download" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{t.footerDownload}</Link>
            <Link href="/pricing" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{t.footerPricing}</Link>
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{t.footerPrivacy}</Link>
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{t.footerTerms}</Link>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">&copy; 2026 Tastile. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
