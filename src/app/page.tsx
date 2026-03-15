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

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <span className="font-mono font-bold text-lg tracking-tight">tastile</span>
          <nav className="flex items-center gap-2">
            <Link href="#features" className="hidden sm:block px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              機能
            </Link>
            <Link href="/pricing" className="hidden sm:block px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              料金
            </Link>
            <Link href="/download" className="hidden sm:block px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              ダウンロード
            </Link>
            <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1 hidden sm:block" />
            <Link
              href="/login"
              className="ml-1 px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              ダウンロード
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-24 flex flex-col lg:flex-row items-start gap-16">
        {/* Left */}
        <div className="flex-none lg:w-[560px]">
          <span className="inline-block mb-6 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-500 dark:text-zinc-400 tracking-widest uppercase">
            Auto-scheduling execution
          </span>
          <h1 className="text-5xl lg:text-6xl font-bold font-mono leading-tight tracking-tight text-zinc-900 dark:text-zinc-100">
            タスクを入れる。
            <br />
            あとは、
            <br />
            任せてください。
          </h1>
          <p className="mt-8 text-lg leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-[480px]">
            次に何をすべきか、もう自分で考えなくていい。Tastileはタスクの優先順位・期限・あなたの状態を読み取り、最適なタイルをJITで自動選択します。あなたはただ、実行するだけ。
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="px-6 py-3 rounded-md bg-zinc-900 dark:bg-zinc-100 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              無料で始める
            </Link>
            <Link
              href="/download"
              className="px-6 py-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              アプリをダウンロード
            </Link>
          </div>
        </div>

        {/* Right — demo card */}
        <div className="flex-1 w-full">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 space-y-3">
            <p className="text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4">Now executing</p>
            {/* Active tile */}
            <div className="rounded-xl bg-zinc-900 dark:bg-white p-5 flex items-start gap-4">
              <span className="mt-1 w-2 h-2 rounded-full bg-green-500 flex-none" />
              <div>
                <p className="text-sm font-semibold text-white dark:text-zinc-900">競合調査レポートをまとめる</p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">期限: 今日 17:00 · 優先度: 高</p>
              </div>
            </div>
            {/* Ready tiles */}
            {[
              { label: "週次レビューのスライド作成", due: "明日 10:00" },
              { label: "バックログの整理", due: "今週中" },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex items-start gap-4 opacity-50"
              >
                <span className="mt-1 w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-none" />
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tile.label}</p>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">期限: {tile.due}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section id="features" className="bg-zinc-50 dark:bg-zinc-900 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mb-4">
            これがTastile独自のアプローチです
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-12 max-w-xl">
            よくあるタスク管理と根本から違う。タスクを整理するためではなく、実行するために設計されています。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <LayoutGrid className="w-6 h-6" />,
                title: "自動でスケジュールを組む",
                body: "タスクを登録するだけで、Tastileが締め切り・優先度・あなたのエネルギー状態を総合的に判断し、今やるべきタイルを自動的に決めます。毎朝の計画作業が不要になります。",
              },
              {
                icon: <Crosshair className="w-6 h-6" />,
                title: "今やることをひとつだけ教えてくれる",
                body: "複数のタスクを同時に表示しない。システムが選んだひとつのタイルだけにフォーカス。並行作業による集中力の分散を防ぎ、実行の質を高めます。次は何をすべきか、迷う時間はゼロ。",
              },
              {
                icon: <BellRing className="w-6 h-6" />,
                title: "脱線したら、引き戻してくれる",
                body: "作業時間が過ぎてもタイルを完了しないとシステムが介入します。「まだやってる？」「次に進む？」という確認ダイアログで、無意識のドリフトに気づかせてくれます。",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8"
              >
                <div className="text-zinc-700 dark:text-zinc-300 mb-4">{item.icon}</div>
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
          <h2 className="text-3xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mb-4">
            3ステップで始められます
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-16 max-w-xl">
            セットアップは数分。複雑な設定は一切不要です。
          </p>
          <div className="space-y-0">
            {[
              {
                num: "01",
                icon: <ListPlus className="w-5 h-5" />,
                title: "タスクを登録する",
                body: "やりたいこと・やらなければいけないことをタイルとして入力します。期限や大まかな優先度だけ設定すればOK。細かいスケジュールは不要です。",
              },
              {
                num: "02",
                icon: <CalendarRange className="w-5 h-5" />,
                title: "システムが次のタイルを選ぶ",
                body: "あなたが登録したタイルをTastileが自動でスコアリング。優先順位・締め切り・推定作業時間・あなたのエネルギーレベルをもとに、今すべき1枚を自動で選択します。",
              },
              {
                num: "03",
                icon: <CircleCheck className="w-5 h-5" />,
                title: "実行して、完了にするだけ",
                body: "提示されたタイルを開始し、作業し、完了にする。それだけです。次に何をすべきかはTastileが考えます。あなたは「実行」に集中できます。",
              },
            ].map((step, i, arr) => (
              <div key={step.num}>
                <div className="flex items-start gap-8 py-10">
                  <div className="flex-none flex items-center justify-center w-14 h-14 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-mono font-bold text-sm">
                    {step.num}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400 dark:text-zinc-500">
                      {step.icon}
                    </div>
                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 mb-2">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-xl">{step.body}</p>
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="border-b border-zinc-100 dark:border-zinc-800" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-zinc-50 dark:bg-zinc-900 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mb-3">
            まずは無料で始めよう
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-12">
            クレジットカード不要。無料プランでも主要機能はすべて使えます。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">無料</span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">ずっと無料、クレジットカード不要</p>
              <ul className="space-y-3 mb-10">
                {[
                  "タスク登録・自動スケジューリング",
                  "最大50タイル（クラウド）",
                  "30日間の実行履歴",
                  "iOS PWAアプリ対応",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <Check className="w-4 h-4 text-green-500 flex-none mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full py-3 rounded-md border border-zinc-200 dark:border-zinc-700 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                無料で始める
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-100 p-8">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold font-mono text-white dark:text-zinc-900">Pro</span>
                <span className="text-lg font-mono text-zinc-300 dark:text-zinc-600">¥800</span>
                <span className="text-sm text-zinc-400 dark:text-zinc-500">/月</span>
              </div>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-8">年払いで ¥6,400（2ヶ月分お得）</p>
              <ul className="space-y-3 mb-10">
                {[
                  "無制限タイル + 10,000クラウドタイル",
                  "2年間の実行履歴・分析",
                  "デスクトップアプリ同期",
                  "フルダッシュボード・統計",
                  "優先サポート",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-zinc-300 dark:text-zinc-700">
                    <Check className="w-4 h-4 text-green-400 dark:text-green-600 flex-none mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className="block w-full py-3 rounded-md bg-white dark:bg-zinc-900 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Proにアップグレード
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-zinc-900 dark:bg-zinc-950 py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold font-mono text-white leading-tight">
            今日のタスク、
            <br />
            もう迷わなくていい。
          </h2>
          <p className="mt-6 text-zinc-400 text-lg">
            Tastileがあなたの代わりに考えます。あなたはただ、実行するだけ。
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="px-8 py-3 rounded-md bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              無料で始める
            </Link>
            <Link
              href="/download"
              className="px-8 py-3 rounded-md border border-zinc-700 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              アプリをダウンロード
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-10 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row justify-between items-center gap-6">
          <span className="font-mono font-bold text-lg text-zinc-900 dark:text-zinc-100">tastile</span>
          <div className="flex gap-6 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">プライバシー</Link>
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">利用規約</Link>
            <Link href="/pricing" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">料金</Link>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">© 2026 Tastile. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
