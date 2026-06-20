import { CtaSection } from "./CtaSection";
import { ConditionBento } from "./ConditionBento";
import { Faq } from "./Faq";
import { Hero } from "./Hero";
import { LifecycleLoop } from "./LifecycleLoop";
import { Manifesto } from "./Manifesto";
import { PricingTeaser } from "./PricingTeaser";
import "./marketing.css";

export type Lang = "ja" | "en";

export type Dict = {
	hero: {
		badge: string;
		title: [string, string];
		sub: string;
		context: string;
		pierceText: string;
		stats: Array<{ value: string; label: string; sub: string }>;
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
	};
	bento: {
		eyebrow: string;
		title: string;
		intro: string;
		lead: string;
		rows: Array<{ numeral: string; name: string; lede: string; body: string; example: string }>;
		overflow: { name: string; lede: string; body: string; example: string };
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
		timeline: Array<{ time: string; title: string; note: string; kind: "tile" | "adjust" | "overflow" | "break" }>;
	};
	pricing: {
		eyebrow: string;
		title: [string, string];
		intro: string;
		monthly: string;
		yearly: string;
		yearlyNote: string;
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
		items: Array<{ q: string; a: string }>;
	};
	finalCta: {
		pierceText: string;
		title: [string, string];
		note: string;
		promise: string[];
		ctaPrimary: string;
		ctaSecondary: string;
	};
};

export const landingDict: Record<Lang, Dict> = {
	ja: {
		hero: {
			badge: "実行支援ツール",
			title: ["考えるのをやめて、", "ただ実行するだけ。"],
			sub: "タスクを追加すれば、Tastileが時間枠に合わせて自動的にスケジュールを組みます。",
			context: "カレンダー、時計、タスク管理を一つの実行エンジンに統合。あなたが何をすべきかを、あなたに代わってTastileが決定します。",
			pierceText: "実行",
			stats: [
				{ value: "4.2h", label: "集中時間", sub: "1日あたり" },
				{ value: "0", label: "下した決定", sub: "あなたによるもの" },
				{ value: "94%", label: "完了率", sub: "完了したタイル" },
			],
			ctaPrimary: "はじめる",
			ctaSecondary: "ダウンロード",
			ctaPrimaryHref: "/login",
			ctaSecondaryHref: "/download",
			previewActiveLabel: "実行中",
			previewTiles: [
				{ time: "09:00", duration: "60m", title: "資料を仕上げる", place: "スタジオ", state: "active" },
				{ time: "10:30", duration: "20m", title: "メールを片付ける", place: "どこでも", state: "queued" },
				{ time: "12:00", duration: "30m", title: "外を歩く", place: "屋外", state: "queued" },
				{ time: "13:00", duration: "45m", title: "リリースノートを書く", place: "スタジオ", state: "queued" },
			],
			previewNextLabel: "次の予定",
			previewNextAt: "11:20",
			previewNextAction: "完了にする",
		},
		bento: {
			eyebrow: "6つの軸",
			title: "タイルは6つの軸で定義されます。",
			intro: "ひとつのタスクは、6つの軸を組み合わせることで形作られます。",
			lead: "あなたが軸を定義すれば、あとはエンジンが処理します。各軸が他の軸を参照することで、タイルの形状が決定されます。",
			rows: [
				{
					numeral: "01",
					name: "締め切り",
					lede: "完了期限",
					body: "タイルが期限を記憶します。エンジンが進捗状況と空き時間を逆算し、最も効果的な場所に配置します。遅延が発生した場合は即座に検知し、次に空いているスロットへスケジュールを再設定します。",
					example: "「金曜17時までに資料を送る」→ エンジンが水曜か木曜の午前中を自動で選ぶ。",
				},
				{
					numeral: "02",
					name: "場所",
					lede: "どこで行うか",
					body: "どこで行うかも軸の一つです。場所と時間帯の相性を考慮し、最も集中力が高まる時間枠を選定します。",
					example: "「外出先」+ 午前中 → 移動時間を避ける。「スタジオ」+ 午後 → 集中枠として確保。",
				},
				{
					numeral: "03",
					name: "状態",
					lede: "開始時に変化するもの",
					body: "開始すると、何が変わりますか？周囲の環境が状態に基づいて自動的に設定されます。フォーカスモードへの移行、通知の抑制、関連ドキュメントのオープンなどが行われます。",
					example: "開始 → 集中モード起動 → 通知を自動で抑える / 関連ドキュメントを自動で開く。",
				},
				{
					numeral: "04",
					name: "変容",
					lede: "途中で形を変える",
					body: "途中で形を変えることは問題ありません。状況に応じて、不要なものを削り、不足しているものを補ってください。もし60分のタスクが45分で終わりそうであれば、残りの時間は次のタスクに割り当てます。",
					example: "60分のタスク → 45分に短縮 + 残り15分は後続の待機タスクへ自動で組み込み。",
				},
				{
					numeral: "05",
					name: "完了",
					lede: "何をもって終了とするか",
					body: "何をもって完了とするかは、タイル自体によって定義されます。チェックリスト、出力ファイル、外部通知など、複数の条件を設定できます。完了とは人の判断ではなく、タイル仕様として記述されるものです。",
					example: "チェックリスト全項目にチェック → 自動で完了状態に。出力ファイルが所定の場所に出る → 自動で完了。",
				},
				{
					numeral: "06",
					name: "オーバーフロー",
					lede: "あふれた分は次のスロットへ",
					body: "予定より時間がかかった場合、タイルが自身のオーバーフロー動作を判断します。たとえ45分のタスクに55分かかったとしても、データが失われることはありません。タスクはその状態を保持したまま、次に利用可能なスロットへ移動します。",
					example: "45分の予定が55分かかる → 残り5分は12:00の空き枠に自動で組み込み。履歴にも残る。",
				},
			],
			overflow: {
				name: "オーバーフロー",
				lede: "あふれた分は次のスロットへ",
				body: "予定より時間がかかった場合、タイルが自身のオーバーフロー動作を判断します。たとえ45分のタスクに55分かかったとしても、データが失われることはありません。タスクはその状態を保持したまま、次に利用可能なスロットへ移動します。",
				example: "45分の予定が55分かかる → 残り5分は12:00の空き枠に自動で組み込み。履歴にも残る。",
			},
		},
		lifecycle: {
			eyebrow: "常時まわり続ける",
			title: "6つの動作",
			intro: "エンジンは、入力から調整まで6つの動作を常にまわし続ける。",
			lead: "あなたが操作するのは「やること」と、6つの軸だけ。残りの動作は、エンジンが常時まわり続けて自動で処理する。",
			phases: ["入力", "編成", "配置", "実行", "観測", "調整"],
			phaseDetails: [
				{
					title: "入力",
					description: "あなたが決めるのはここまで。やること、期限、場所、状態。エンジンはそれ以外のすべてを受け持つ。",
				},
				{
					title: "編成",
					description: "6つの軸で並び替える。重複するタスクを検出し、関連タスクを束ねる。優先順位は明示せず、条件で決まる。",
				},
				{
					title: "配置",
					description: "1日の中の最適な空き枠に置く。場所と時間帯の相性も考慮。移動時間や休憩も計算に入れる。",
				},
				{
					title: "実行",
					description: "実行中は、タイルが最優先。周囲の通知を自動で抑え、関連資料を開き、次のタスクを準備する。",
				},
				{
					title: "観測",
					description: "進捗と状態を毎分観測。遅れたら即座に検知し、変化を吸収する。放置されるタスクは生まれない。",
				},
				{
					title: "調整",
					description: "スケジュールを組み直す。残ったタスクを次へ流す。履歴として蓄積し、翌日の配置の精度を上げる。",
				},
			],
			activeLabel: "いまここ",
		},
		manifesto: {
			eyebrow: "思想",
			title: ["タスク管理ではない。", "実行の、エンジン。"],
			lead: "Tastileはタスクを追加する道具ではなく、実行をまわすエンジンである。あなたがすることは「決める」ではなく「走り切る」になる。",
			leftLabel: "いつものタスク管理",
			leftItems: [
				"計画を立てる",
				"優先度をつける",
				"期限を確認する",
				"手動で並び替える",
				"遅れたら追いかける",
				"何が起きたか忘れる",
			],
			rightLabel: "Tastile",
			rightHeadline: "1つのタイルが、今この瞬間に動いている。",
			rightSubtext: "他は、全部エンジンが面倒を見ている。",
			timelineTitle: "Tastileのある1日",
			timelineSubtitle: "09:00から18:00まで、エンジンがやったこと。",
			timeline: [
				{ time: "09:00", title: "資料を仕上げる", note: "スタジオで60分。集中モード起動、通知を自動で抑える。", kind: "tile" },
				{ time: "09:35", title: "前倒し調整", note: "進捗が予定より早い。次のタイルを5分前倒し。", kind: "adjust" },
				{ time: "10:30", title: "メールを片付ける", note: "20分の予定。場所は「どこでも」。移動中にも実行可能。", kind: "tile" },
				{ time: "11:00", title: "超過処理", note: "想定外の30分かかる。残り10分は12:00の空き枠へ。", kind: "overflow" },
				{ time: "12:00", title: "外を歩く", note: "屋外で30分。通知は自動で抑えたまま。", kind: "break" },
				{ time: "13:00", title: "リリースノートを書く", note: "スタジオで45分。資料を開く動作も自動化。", kind: "tile" },
				{ time: "18:00", title: "観測と調整", note: "今日の実行パターンを記録。翌朝の配置精度が上がる。", kind: "adjust" },
			],
		},
		pricing: {
			eyebrow: "料金",
			title: ["無料で、始める。", "必要になったら、Proへ。"],
			intro: "主要機能はそのまま無料。Proは無制限タイル・2年分の履歴・デスクトップ同期。アップグレードもダウングレードもいつでも。",
			monthly: "月額",
			yearly: "年額",
			yearlyNote: "2か月分お得",
			free: {
				name: "Free",
				price: "$0",
				tagline: "個人利用と試用に。",
				cta: "無料で始める",
				features: [
					{ title: "30タイルまで", detail: "典型的な1日分のタスクは余裕で収まる。" },
					{ title: "分単位スケジュール", detail: "6軸の自動配置。場所を条件に含められる。" },
					{ title: "30日分の履歴", detail: "実行パターンを振り返る。" },
					{ title: "Webアプリ", detail: "ブラウザとPWAで動作。ログインだけで使える。" },
				],
				footnote: "クレジットカード不要。制限を超えたら、Proへの案内が出る。",
			},
			pro: {
				name: "Pro",
				badge: "おすすめ",
				tagline: "日常的に使い込む人へ。",
				cta: "Proにする",
				features: [
					{ title: "タイル完全無制限", detail: "上限なし。大量に積んでもエンジンが捌く。" },
					{ title: "2年分の履歴", detail: "年間トレンドと曜日パターンを可視化。" },
					{ title: "デスクトップ同期", detail: "Windows/Mac/iOSで同じ状態を共有。" },
					{ title: "優先サポート", detail: "問い合わせに48時間以内に返信。" },
				],
				footnote: "年額なら月額2か月分お得。いつでも解約できる。",
			},
		},
		faq: {
			eyebrow: "質問",
			title: "質問。",
			intro: "迷うより、走らせる。判断に時間を使うより、実行に時間を使う。",
			items: [
				{ q: "既存のアプリと、何が違う？", a: "カレンダー・時計・タスクを一つにする。アプリを切り替える動作が、なくなる。予定を立てるのではなく、タイルが動く。" },
				{ q: "スケジュールが変わったら？", a: "自動で組み直される。遅れた場合も、空き時間ができた場合も、エンジンが即座に再配置する。手動で直す必要はない。" },
				{ q: "タスクが終わらなかったら？", a: "次の空き時間に自動で入る。残り5分でも、翌日でも、履歴として残しつつ、積み残さず次へ流す。タスクが消えることはない。" },
				{ q: "どんな人に向いている？", a: "「何から始めよう」と悩む時間を減らしたい人。1日の中でタスクが散らばる人。実行そのものに向き合いたい人。" },
				{ q: "データは誰が持っていますか？", a: "あなたが持つ。エクスポート機能ですべての履歴と設定を取り出せる。削除も完全に行える。" },
				{ q: "オフラインで使えますか？", a: "Web版は基本オンライン。デスクトップ版はオフライン動作に対応し、再接続時に同期する。" },
				{ q: "Googleカレンダーと連携できますか？", a: "Proでは双向同期に対応する予定。固定の予定はタイルとして取り込める。" },
				{ q: "解約はいつでもできますか？", a: "いつでも。解約後も履歴は残り、Freeに戻って引き続き利用できる。" },
			],
		},
		finalCta: {
			pierceText: "走らせる",
			title: ["管理するのを、やめる。", "走らせる。"],
			note: "Tastileは、まず無料で。Webアプリ単体でも、デスクトップと組み合わせても、どちらでも。",
			promise: [
				"クレジットカード不要",
				"30タイルまでずっと無料",
				"いつでもProに切り替え",
			],
			ctaPrimary: "始める",
			ctaSecondary: "ダウンロード",
		},
	},
	en: {
		hero: {
			badge: "Execution support tool",
			title: ["Stop thinking.", "Just execute."],
			sub: "Add tasks. Tastile builds the schedule down to the minute.",
			context: "An execution engine that unifies calendar, clock, and tasks into one surface. Tastile makes the 'what should I do next?' decision for you.",
			pierceText: "EXECUTE",
			stats: [
				{ value: "4.2h", label: "Focus time", sub: "per day" },
				{ value: "0", label: "Decisions", sub: "you made" },
				{ value: "94%", label: "Done rate", sub: "yesterday's tiles" },
			],
			ctaPrimary: "Get started",
			ctaSecondary: "Download",
			ctaPrimaryHref: "/login",
			ctaSecondaryHref: "/download",
			previewActiveLabel: "Running",
			previewTiles: [
				{ time: "09:00", duration: "60m", title: "Finish the deck", place: "Studio", state: "active" },
				{ time: "10:30", duration: "20m", title: "Clear inbox", place: "Anywhere", state: "queued" },
				{ time: "12:00", duration: "30m", title: "Walk, no phone", place: "Outdoors", state: "queued" },
				{ time: "13:00", duration: "45m", title: "Draft release notes", place: "Studio", state: "queued" },
			],
			previewNextLabel: "Next",
			previewNextAt: "11:20",
			previewNextAction: "Mark done",
		},
		bento: {
			eyebrow: "The 6 axes",
			title: "Tiles are defined by six conditions.",
			intro: "A task takes shape from a combination of six conditions.",
			lead: "You set the conditions. The engine handles the rest. Each axis is not isolated — they reference each other, and together they shape the tile's character.",
			rows: [
				{
					numeral: "01",
					name: "Deadline",
					lede: "When it is due",
					body: "The tile carries its own deadline. The engine works backward from progress and free time, and places the tile where it lands hardest. Slip is detected instantly and folded into the next open slot. The deadline is not a hard wall — it is a 'preferred arrival time' the tile carries.",
					example: "“Send the deck by Fri 5pm.” → Engine picks Wed or Thu morning automatically.",
				},
				{
					numeral: "02",
					name: "Place",
					lede: "Where it happens",
					body: "Place is one of the axes too. The engine matches place to time of day, and picks the slot where focus actually lands. It distinguishes indoor from outdoor, focus from transit. Place is not just a tag — it shapes the tile's personality.",
					example: "“Outdoors” + morning → skip transit windows. “Studio” + afternoon → reserve as a focus block.",
				},
				{
					numeral: "03",
					name: "State",
					lede: "What changes on start",
					body: "On start, the world rearranges. The engine sets focus mode, quiets notifications, opens the documents that matter. State changes flow from the tile itself. Starting a tile is not 'you do something' — it is 'the world tilts toward this task'.",
					example: "Start → focus mode on → notifications silenced / related docs open automatically.",
				},
				{
					numeral: "04",
					name: "Deform",
					lede: "Shifts shape mid-run",
					body: "Tiles can change shape mid-run. Trim what is no longer needed, fill what is short. A 60-minute slot that finishes in 45 redistributes the spare 15 to the next waiting tile. Deform is not failure — it is optimization, and the history keeps every record.",
					example: "60m task → trimmed to 45m + 15m folded into the next waiting tile automatically.",
				},
				{
					numeral: "05",
					name: "Complete",
					lede: "How it knows it is done",
					body: "The tile carries its own definition of done. Nothing closes by accident, nothing stays open by guesswork. Checklists, output files, external notifications. Multiple conditions can stack. 'Done' is not human opinion — it is a spec the tile carries.",
					example: "Every checkbox ticked → done. Output file lands in the right folder → done.",
				},
				{
					numeral: "06",
					name: "Overflow",
					lede: "The remainder rolls into the next open slot",
					body: "What happens when a tile runs past its time is decided by the tile itself. A 45-minute slot that takes 55 still keeps the leftover 5 and folds it forward. Nothing is dropped, every tile stays in a state. Overflow is not failure — it is normal engine behavior.",
					example: "45m slot runs to 55m → the leftover 5m slots into 12:00 automatically. The history keeps the record.",
				},
			],
			overflow: {
				name: "Overflow",
				lede: "The remainder rolls into the next open slot",
				body: "What happens when a tile runs past its time is decided by the tile itself. A 45-minute slot that takes 55 still keeps the leftover 5 and folds it forward. Nothing is dropped, every tile stays in a state.",
				example: "45m slot runs to 55m → the leftover 5m slots into 12:00 automatically. The history keeps the record.",
			},
		},
		lifecycle: {
			eyebrow: "Always running",
			title: "Six steps",
			intro: "The engine runs six steps continuously, from input to adjust.",
			lead: "You only touch the task and the six conditions. The rest is the engine, running continuously, in the background.",
			phases: ["Input", "Compile", "Place", "Execute", "Observe", "Adjust"],
			phaseDetails: [
				{ title: "Input", description: "You stop here. The task, the deadline, the place, the state. The engine takes everything else." },
				{ title: "Compile", description: "Sort by the six conditions. Detect duplicates, group related work. Priorities are not declared — they fall out of conditions." },
				{ title: "Place", description: "Drop into the best open slot of the day. Match place to time of day. Count transit and breaks." },
				{ title: "Execute", description: "While running, the tile is the top priority. The engine quiets the world, opens related material, preps the next tile." },
				{ title: "Observe", description: "Sample progress and state every minute. Catch slip the moment it happens. No tile stays abandoned." },
				{ title: "Adjust", description: "Rebuild the schedule. Carry the leftovers forward. Log it as history. Tomorrow's placement gets sharper." },
			],
			activeLabel: "Live",
		},
		manifesto: {
			eyebrow: "Manifesto",
			title: ["Not a task manager.", "An execution engine."],
			lead: "Tastile is not a tool to add tasks. It is an engine to run execution. Your job is not to decide — it is to finish.",
			leftLabel: "A usual task manager",
			leftItems: [
				"Plan it",
				"Rank it",
				"Check the deadline",
				"Reorder by hand",
				"Chase the slip",
				"Forget what happened",
			],
			rightLabel: "Tastile",
			rightHeadline: "One tile is moving right now.",
			rightSubtext: "Everything else is on the engine.",
			timelineTitle: "A real day with Tastile",
			timelineSubtitle: "From 09:00 to 18:00, here is what the engine did.",
			timeline: [
				{ time: "09:00", title: "Finish the deck", note: "Studio, 60 minutes. Focus mode on, notifications silenced.", kind: "tile" },
				{ time: "09:35", title: "Pull-ahead adjustment", note: "Running ahead of schedule. Next tile pulled up by 5 minutes.", kind: "adjust" },
				{ time: "10:30", title: "Clear inbox", note: "20 minutes, place: anywhere. Runs in transit.", kind: "tile" },
				{ time: "11:00", title: "Overflow", note: "Unexpected 30 minutes. The leftover 10 slots into 12:00.", kind: "overflow" },
				{ time: "12:00", title: "Walk, no phone", note: "Outdoors, 30 minutes. Notifications stay silenced.", kind: "break" },
				{ time: "13:00", title: "Draft release notes", note: "Studio, 45 minutes. The deck opens automatically.", kind: "tile" },
				{ time: "18:00", title: "Observe and adjust", note: "Today's pattern is logged. Tomorrow morning gets sharper.", kind: "adjust" },
			],
		},
		pricing: {
			eyebrow: "Pricing",
			title: ["Start free.", "Upgrade when you outgrow it."],
			intro: "Core features stay free. Pro adds unlimited tiles, two-year history, and desktop sync. Upgrade or downgrade anytime.",
			monthly: "Monthly",
			yearly: "Yearly",
			yearlyNote: "Two months free",
			free: {
				name: "Free",
				price: "$0",
				tagline: "For trying it out.",
				cta: "Get started",
				features: [
					{ title: "Up to 30 tiles", detail: "A typical day's worth of work, with headroom." },
					{ title: "Minute-level schedule", detail: "Six-axis placement, place-aware, automatic." },
					{ title: "30-day history", detail: "Look back at execution patterns." },
					{ title: "Web app", detail: "Browser and PWA. Log in and go." },
				],
				footnote: "No credit card. When you hit a limit, we point you at Pro.",
			},
			pro: {
				name: "Pro",
				badge: "Recommended",
				tagline: "For people who run on Tastile daily.",
				cta: "Upgrade to Pro",
				features: [
					{ title: "Unlimited tiles", detail: "No cap. The engine handles volume." },
					{ title: "Two-year history", detail: "Year-over-year trends, weekday patterns, visible." },
					{ title: "Desktop sync", detail: "Windows, Mac, iOS in lock-step with the web app." },
					{ title: "Priority support", detail: "Reply within 48 hours, business days." },
				],
				footnote: "Yearly saves two months. Cancel anytime.",
			},
		},
		faq: {
			eyebrow: "Questions",
			title: "Questions.",
			intro: "Run, not ruminate. Spend time executing, not deciding.",
			items: [
				{ q: "How is this different?", a: "Calendar, clock, and tasks, in one place. No more switching apps. You do not plan — the tile moves." },
				{ q: "What if the schedule changes?", a: "The engine rebuilds it. Slip or a new opening, either way the schedule reshapes instantly. No manual edits." },
				{ q: "What if I do not finish a task?", a: "The leftover rolls into the next open slot. Five minutes or five hours, the history keeps the record, and nothing is dropped." },
				{ q: "Who is this for?", a: "Anyone who wants to spend less time planning and more time executing. Anyone whose tasks scatter across the day. Anyone ready to face the work itself." },
				{ q: "Who owns the data?", a: "You do. Export every event and setting. Delete fully, any time." },
				{ q: "Does it work offline?", a: "The web app needs a connection. The desktop client works offline and syncs when it comes back." },
				{ q: "Can it sync with my calendar?", a: "Two-way Google Calendar sync is on the Pro roadmap. Fixed events come in as tiles." },
				{ q: "Can I cancel anytime?", a: "Anytime. After cancelling, history stays and you keep using Free." },
			],
		},
		finalCta: {
			pierceText: "RUN",
			title: ["Stop managing.", "Start running."],
			note: "Free to start. Web app on its own, or paired with the desktop client.",
			promise: [
				"No credit card",
				"30 tiles free, forever",
				"Upgrade or cancel anytime",
			],
			ctaPrimary: "Get started",
			ctaSecondary: "Download",
		},
	},
};

export function LandingPage({ t, lang }: { t: Dict; lang: Lang }) {
	return (
		<div className="bg-background text-foreground">
			<Hero t={t.hero} lang={lang} />
			<ConditionBento t={t.bento} lang={lang} />
			<LifecycleLoop t={t.lifecycle} lang={lang} />
			<Manifesto t={t.manifesto} lang={lang} />
			<PricingTeaser t={t.pricing} lang={lang} />
			<Faq t={t.faq} lang={lang} />
			<CtaSection t={t.finalCta} lang={lang} />
		</div>
	);
}
