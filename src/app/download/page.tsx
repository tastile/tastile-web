import { getTranslation } from "@/shared/i18n/get-translation";
import {
	getFooterTranslations,
	getHeaderTranslations,
} from "@/shared/i18n/server-translations";
import type { Locale } from "@/shared/stores/locale-store";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";
import { TastileLogo } from "@/shared/ui/TastileLogo";
import { Badge, Button } from "@mantine/core";
import { ArrowUpRight } from "lucide-react";

export const metadata = {
	title: getTranslation("en", "metadata.download.title"),
	description: getTranslation("en", "metadata.download.description"),
};

const SUPPORTED_LANGS = [
	"en",
	"ja",
	"zh-CN",
	"ko",
	"es",
] as const satisfies readonly Locale[];

type Lang = (typeof SUPPORTED_LANGS)[number];

// NF04-W06 (tastile-web#257): the distribution page lists every release
// channel — Web app, Desktop via Microsoft Store, CLI via GitHub Releases,
// and Android via Google Play — plus the privacy policy. Store / Play
// listing URLs are not live yet (desktop#62 / store review pending), so
// they are env-configured; unset channels render a "Coming soon" badge
// instead of a dead link. The CLI releases page is a stable public URL.
//
// The legacy Windows installer path (`/api/download/windows`,
// `TASTILE_DESKTOP_MANIFEST_URL`) is intentionally not linked here: NF04
// distribution goes through the Store / GitHub Releases channels only —
// installers must not be proxied through the Tunnel/API (see tastile-root
// issue NF04-W06 acceptance criteria).
const CLI_RELEASES_URL = "https://github.com/tastile/tastile-cli/releases";

function storeUrl(): string {
	return process.env.NEXT_PUBLIC_TASTILE_STORE_URL?.trim() ?? "";
}

function androidUrl(): string {
	return process.env.NEXT_PUBLIC_TASTILE_ANDROID_URL?.trim() ?? "";
}

const COPY: Record<
	Lang,
	{
		title: string;
		body: string;
		cta: string;
		channelsHeading: string;
		privacyNote: string;
		privacyLink: string;
		comingSoon: string;
		channels: Record<
			"web" | "desktop" | "cli" | "android",
			{ name: string; description: string; action: string }
		>;
	}
> = {
	en: {
		title: "Get Tastile",
		body: "Tastile is available on the web today, with native apps for Windows and Android on the way. Pick the channel that fits how you work.",
		cta: "Open the web app",
		channelsHeading: "Download channels",
		privacyNote:
			"Tastile only requests the permissions each platform requires. See our",
		privacyLink: "privacy policy",
		comingSoon: "Coming soon",
		channels: {
			web: {
				name: "Web app",
				description:
					"The canonical surface. Works in any modern browser — no install needed.",
				action: "Open app",
			},
			desktop: {
				name: "Desktop for Windows",
				description:
					"Native app with OS-level scheduling, tray resident mode, and notifications. Distributed via Microsoft Store.",
				action: "Microsoft Store",
			},
			cli: {
				name: "CLI",
				description:
					"Command-line client for scripts and CI, distributed via GitHub Releases.",
				action: "GitHub Releases",
			},
			android: {
				name: "Android",
				description:
					"Mobile companion for reviewing your day and capturing quick inputs.",
				action: "Google Play",
			},
		},
	},
	ja: {
		title: "Tastile を入手",
		body: "Tastile は現在 Web で利用でき、Windows / Android のネイティブアプリを順次提供します。使い方に合った配布チャネルを選んでください。",
		cta: "Web アプリを開く",
		channelsHeading: "ダウンロードチャネル",
		privacyNote: "Tastile が要求するのは各プラットフォームに必要な権限のみです。詳しくは",
		privacyLink: "プライバシーポリシー",
		comingSoon: "近日公開",
		channels: {
			web: {
				name: "Web アプリ",
				description:
					"正規の surface です。モダンブラウザでそのまま使え、インストール不要です。",
				action: "アプリを開く",
			},
			desktop: {
				name: "Desktop（Windows）",
				description:
					"OS レベルのスケジューリング、トレイ常駐、通知を備えたネイティブアプリ。Microsoft Store で配布します。",
				action: "Microsoft Store",
			},
			cli: {
				name: "CLI",
				description:
					"スクリプトや CI から使えるコマンドラインクライアント。GitHub Releases で配布します。",
				action: "GitHub Releases",
			},
			android: {
				name: "Android",
				description:
					"1日の振り返りとクイック入力のためのモバイルコンパニオンです。",
				action: "Google Play",
			},
		},
	},
	"zh-CN": {
		title: "获取 Tastile",
		body: "Tastile 现已在网页端提供，并将陆续推出 Windows 与 Android 原生应用。请选择适合您的获取渠道。",
		cta: "打开网页应用",
		channelsHeading: "下载渠道",
		privacyNote: "Tastile 仅申请各平台所需的权限。详见我们的",
		privacyLink: "隐私政策",
		comingSoon: "即将推出",
		channels: {
			web: {
				name: "网页应用",
				description: "正版界面，现代浏览器即可使用，无需安装。",
				action: "打开应用",
			},
			desktop: {
				name: "Windows 桌面版",
				description:
					"具备 OS 级调度、托盘常驻与通知的原生应用，通过 Microsoft Store 分发。",
				action: "Microsoft Store",
			},
			cli: {
				name: "CLI",
				description: "适用于脚本与 CI 的命令行客户端，通过 GitHub Releases 分发。",
				action: "GitHub Releases",
			},
			android: {
				name: "Android",
				description: "用于回顾每日安排与快速录入的移动伴侣。",
				action: "Google Play",
			},
		},
	},
	ko: {
		title: "Tastile 받기",
		body: "Tastile은 현재 웹에서 사용할 수 있으며 Windows 및 Android 네이티브 앱이 순차 제공될 예정입니다. 사용 방식에 맞는 채널을 선택하세요.",
		cta: "웹 앱 열기",
		channelsHeading: "다운로드 채널",
		privacyNote: "Tastile은 각 플랫폼에 필요한 권한만 요청합니다. 자세한 내용은",
		privacyLink: "개인정보 처리방침",
		comingSoon: "출시 예정",
		channels: {
			web: {
				name: "웹 앱",
				description: "정식 화면입니다. 최신 브라우저에서 설치 없이 바로 사용할 수 있습니다.",
				action: "앱 열기",
			},
			desktop: {
				name: "Windows 데스크톱",
				description:
					"OS 수준 스케줄링, 트레이 상주, 알림을 지원하는 네이티브 앱입니다. Microsoft Store로 배포됩니다.",
				action: "Microsoft Store",
			},
			cli: {
				name: "CLI",
				description: "스크립트와 CI에서 사용할 수 있는 커맨드라인 클라이언트입니다. GitHub Releases로 배포됩니다.",
				action: "GitHub Releases",
			},
			android: {
				name: "Android",
				description: "하루를 돌아보고 빠르게 입력할 수 있는 모바일 컴패니언입니다.",
				action: "Google Play",
			},
		},
	},
	es: {
		title: "Obtener Tastile",
		body: "Tastile está disponible en la web hoy, con aplicaciones nativas para Windows y Android en camino. Elige el canal que mejor se adapte a tu forma de trabajar.",
		cta: "Abrir la aplicación web",
		channelsHeading: "Canales de descarga",
		privacyNote:
			"Tastile solo solicita los permisos que cada plataforma requiere. Consulta nuestra",
		privacyLink: "política de privacidad",
		comingSoon: "Próximamente",
		channels: {
			web: {
				name: "Aplicación web",
				description:
					"La superficie oficial. Funciona en cualquier navegador moderno, sin instalación.",
				action: "Abrir app",
			},
			desktop: {
				name: "Desktop para Windows",
				description:
					"Aplicación nativa con programación a nivel de SO, modo residente en bandeja y notificaciones. Se distribuye vía Microsoft Store.",
				action: "Microsoft Store",
			},
			cli: {
				name: "CLI",
				description:
					"Cliente de línea de comandos para scripts y CI, distribuido vía GitHub Releases.",
				action: "GitHub Releases",
			},
			android: {
				name: "Android",
				description:
					"Compañero móvil para revisar tu día y capturar entradas rápidas.",
				action: "Google Play",
			},
		},
	},
};

type ChannelKey = keyof (typeof COPY)["en"]["channels"];

function channelHref(key: ChannelKey): string | null {
	switch (key) {
		case "web":
			return "/login";
		case "desktop": {
			const url = storeUrl();
			return url || null;
		}
		case "cli":
			return CLI_RELEASES_URL;
		case "android": {
			const url = androidUrl();
			return url || null;
		}
	}
}

const CHANNEL_ORDER: readonly ChannelKey[] = ["web", "desktop", "cli", "android"];

export default async function DownloadPage({
	searchParams,
}: {
	searchParams: Promise<{ lang?: string }>;
}) {
	const params = await searchParams;
	const requested = params.lang;
	const lang: Locale = (SUPPORTED_LANGS as readonly string[]).includes(
		requested ?? "",
	)
		? (requested as Locale)
		: "en";
	const copy = COPY[lang as Lang];

	return (
		<div className="min-h-dvh bg-background flex flex-col">
			<SiteHeader translations={getHeaderTranslations(lang)} />
			<main className="flex-1">
				<div className="layout-shell max-w-4xl py-20">
					<div>
						<div className="flex items-center gap-4">
							<TastileLogo className="h-10 w-auto text-foreground" />
							<h1 className="text-4xl font-[510] tracking-[-0.03em] text-foreground">
								{copy.title}
							</h1>
						</div>
						<p className="mt-4 text-lg text-foreground-muted">{copy.body}</p>
					</div>

					<div className="mt-12">
						<Button
							variant="outline"
							radius="xl"
							rightSection={<ArrowUpRight size={16} />}
							component="a"
							href="/login"
							className="inline-block rounded-full bg-surface-1 px-6 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
						>
							{copy.cta}
						</Button>
					</div>

					<section className="mt-16" aria-labelledby="download-channels">
						<h2
							id="download-channels"
							className="text-2xl font-[510] tracking-[-0.02em] text-foreground"
						>
							{copy.channelsHeading}
						</h2>
						<ul className="mt-6 grid gap-4 sm:grid-cols-2">
							{CHANNEL_ORDER.map((key) => {
								const channel = copy.channels[key];
								const href = channelHref(key);
								return (
									<li
										key={key}
										className="rounded-2xl border border-border bg-surface-1 p-5"
									>
										<div className="flex items-start justify-between gap-3">
											<h3 className="text-base font-[590] text-foreground">
												{channel.name}
											</h3>
											{href ? null : (
												<Badge variant="light" color="gray" radius="xl">
													{copy.comingSoon}
												</Badge>
											)}
										</div>
										<p className="mt-2 text-sm text-foreground-muted">
											{channel.description}
										</p>
										{href ? (
											<Button
												variant="subtle"
												radius="xl"
												rightSection={<ArrowUpRight size={14} />}
												component="a"
												href={href}
												target={href.startsWith("http") ? "_blank" : undefined}
												rel={
													href.startsWith("http")
														? "noopener noreferrer"
														: undefined
												}
												className="mt-4 px-0 text-sm font-medium text-foreground"
											>
												{channel.action}
											</Button>
										) : null}
									</li>
								);
							})}
						</ul>
					</section>

					<p className="mt-12 text-sm text-foreground-muted">
						{copy.privacyNote}{" "}
						<a href="/privacy" className="text-foreground underline">
							{copy.privacyLink}
						</a>
						.
					</p>
				</div>
			</main>
			<SiteFooter translations={getFooterTranslations(lang)} locale={lang} />
		</div>
	);
}
