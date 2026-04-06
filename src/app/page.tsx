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
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const dict = {
  ja: {
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
    <div className="min-h-screen bg-background text-foreground">

      <SiteHeader showFeatureLink />

      {/* Hero */}
      <section className="layout-shell py-24">
        <div className="layout-grid-2 items-start gap-16">
        <div className="flex-none lg:w-[560px]">
          <span className="mb-6 inline-block rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest text-foreground-subtle">
            {t.heroBadge}
          </span>
          <h1 className="text-5xl font-[510] leading-[1.02] tracking-[-0.04em] text-foreground lg:text-6xl">
            {t.heroTitle.map((line, i) => (
              <span key={i}>{line}{i < t.heroTitle.length - 1 && <br />}</span>
            ))}
          </h1>
          <p className="mt-8 max-w-[480px] text-lg leading-relaxed text-foreground-muted">
            {t.heroBody}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">
              {t.heroCta1}
            </Link>
            <Link href="/download" className="rounded-md border border-border bg-surface-1 px-6 py-3 text-sm font-medium text-foreground-muted hover:bg-surface-2 hover:text-foreground">
              {t.heroCta2}
            </Link>
          </div>
        </div>

        {/* Demo card */}
        <div className="flex-1 w-full">
           <div className="space-y-3 rounded-xl border border-border bg-surface-elevated p-6">
             <p className="mb-4 text-xs uppercase tracking-widest text-foreground-subtle">{t.demoLabel}</p>
             <div className="flex items-start gap-4 rounded-md border border-border bg-surface-2 p-5">
              <span className="mt-1 w-2 h-2 rounded-full bg-green-500 flex-none" />
              <div>
                 <p className="text-sm font-medium text-foreground">{t.demoActive}</p>
                 <p className="mt-1 text-xs text-foreground-subtle">{t.demoActiveMeta}</p>
              </div>
            </div>
            {t.demoTiles.map((tile) => (
               <div key={tile.label} className="flex items-start gap-4 rounded-md border border-border bg-surface-1 p-4 opacity-60">
                 <span className="mt-1 h-2 w-2 flex-none rounded-full bg-foreground-subtle" />
                <div>
                   <p className="text-sm font-medium text-foreground-muted">{tile.label}</p>
                   <p className="mt-0.5 text-xs text-foreground-subtle">{t.demoTileDuePrefix}{tile.due}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>

      {/* Pillars */}
      <section id="features" className="bg-surface-0 py-24">
        <div className="layout-shell">
          <h2 className="mb-4 text-3xl font-[510] tracking-[-0.02em] text-foreground">{t.pillarsTitle}</h2>
          <p className="mb-12 max-w-xl text-foreground-muted">{t.pillarsBody}</p>
          <div className="layout-grid-3">
            {t.pillars.map((item, i) => (
               <div key={item.title} className="rounded-xl border border-border bg-surface-elevated p-8">
                 <div className="mb-4 text-foreground-muted">{pillarIcons[i]}</div>
                 <h3 className="mb-3 text-lg font-[590] tracking-[-0.01em] text-foreground">{item.title}</h3>
                 <p className="text-sm leading-relaxed text-foreground-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="layout-shell">
          <h2 className="mb-4 text-3xl font-[510] tracking-[-0.02em] text-foreground">{t.stepsTitle}</h2>
          <p className="mb-16 max-w-xl text-foreground-muted">{t.stepsBody}</p>
          <div className="space-y-0">
            {t.steps.map((step, i, arr) => (
              <div key={i}>
                <div className="flex items-start gap-8 py-10">
                  <div className="flex h-14 w-14 flex-none items-center justify-center rounded-md bg-primary text-sm font-semibold tabular-nums text-primary-fg">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2 text-foreground-subtle">{stepIcons[i]}</div>
                    <h3 className="mb-2 text-lg font-[590] text-foreground">{step.title}</h3>
                    <p className="max-w-xl text-sm leading-relaxed text-foreground-muted">{step.body}</p>
                  </div>
                </div>
                {i < arr.length - 1 && <div className="border-b border-border" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-surface-0 py-24">
        <div className="layout-shell max-w-5xl">
          <h2 className="mb-3 text-3xl font-[510] tracking-[-0.02em] text-foreground">{t.pricingTitle}</h2>
          <p className="mb-12 text-foreground-muted">{t.pricingBody}</p>
          <div className="layout-grid-2">
            {/* Free */}
            <div className="rounded-xl border border-border bg-surface-elevated p-8">
              <div className="flex items-baseline gap-2 mb-1">
                 <span className="text-2xl font-[590] text-foreground">{t.freeLabel}</span>
              </div>
               <p className="mb-8 text-sm text-foreground-muted">{t.freeSub}</p>
              <ul className="space-y-3 mb-10">
                {t.freeFeatures.map((f) => (
                   <li key={f} className="flex items-start gap-3 text-sm text-foreground-muted">
                    <Check className="w-4 h-4 text-green-500 flex-none mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
               <Link href="/login" className="block w-full rounded-md border border-border bg-surface-1 py-3 text-center text-sm font-medium text-foreground hover:bg-surface-2">
                {t.freeCta}
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-xl border border-border bg-surface-elevated p-8">
              <div className="flex items-baseline gap-2 mb-1">
                 <span className="text-2xl font-[590] text-foreground">Pro</span>
                 <span className="text-lg text-foreground-muted">{t.proPrice}</span>
                 <span className="text-sm text-foreground-subtle">{t.proPer}</span>
              </div>
               <p className="mb-8 text-sm text-foreground-muted">{t.proSub}</p>
              <ul className="space-y-3 mb-10">
                {t.proFeatures.map((f) => (
                   <li key={f} className="flex items-start gap-3 text-sm text-foreground-muted">
                     <Check className="mt-0.5 h-4 w-4 flex-none text-success" />
                    {f}
                  </li>
                ))}
              </ul>
               <Link href="/pricing" className="block w-full rounded-md bg-primary py-3 text-center text-sm font-medium text-primary-fg hover:bg-primary-hover">
                {t.proCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-surface-0 py-32">
        <div className="layout-shell layout-grid-2 items-start gap-10">
          <div>
          <h2 className="text-4xl font-[510] leading-tight tracking-[-0.03em] text-foreground lg:text-5xl">
            {t.ctaTitle.map((line, i) => (
              <span key={i}>{line}{i < t.ctaTitle.length - 1 && <br />}</span>
            ))}
          </h2>
          <p className="mt-6 text-lg text-foreground-muted">{t.ctaBody}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">
              {t.ctaCta1}
            </Link>
            <Link href="/download" className="rounded-md border border-border bg-surface-1 px-8 py-3 text-sm font-medium text-foreground-muted hover:bg-surface-2 hover:text-foreground">
              {t.ctaCta2}
            </Link>
          </div>
          </div>
          <aside className="rounded-xl border border-border bg-surface-elevated p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground-subtle">Execution Focus</p>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              タスク選択の判断をUIから削って 実行面を左カラムへ集約する  
              右側は状態説明と補助情報だけに限定して 画面密度を整える
            </p>
          </aside>
        </div>
      </section>
      <SiteFooter
        labels={{
          webApp: t.footerWebApp,
          download: t.footerDownload,
          pricing: t.footerPricing,
          privacy: t.footerPrivacy,
          terms: t.footerTerms,
        }}
      />
    </div>
  );
}
