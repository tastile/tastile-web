import { getTranslation } from "@/shared/i18n/get-translation";
import {
	getFooterTranslations,
	getHeaderTranslations,
} from "@/shared/i18n/server-translations";
import type { Locale } from "@/shared/stores/locale-store";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";
import { TastileLogo } from "@/shared/ui/TastileLogo";
import { Button } from "@mantine/core";
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

// W06 (2026-09-19 free launch): no Windows / Desktop download is offered.
// The page now describes the Web + Android boundary and points to the web
// app. The previous Windows download CTA, system-requirements block, and
// `/api/download/windows` endpoint remain in the repo but are not linked
// from this page.
const INTRO: Record<(typeof SUPPORTED_LANGS)[number], { title: string; body: string; cta: string }> =
	{
		en: {
			title: "Get Tastile",
			body: "Tastile ships on the web and on Android at launch. There is no Windows or Desktop download at the 9/19 release. The web app is the canonical surface; Android is offered via Google Play.",
			cta: "Open the web app",
		},
		ja: {
			title: "Tastile を入手",
			body: "9/19 リリースでは Web と Android のみ提供します。Windows / Desktop 版は 9/19 リリースでは提供しません。Web アプリが正規の surface、Android は Google Play 経由です。",
			cta: "Web アプリを開く",
		},
		"zh-CN": {
			title: "获取 Tastile",
			body: "9/19 发布时仅提供 Web 与 Android。Windows / Desktop 客户端在 9/19 发布中不提供。Web 应用是正版面，Android 通过 Google Play 提供。",
			cta: "打开网页应用",
		},
		ko: {
			title: "Tastile 받기",
			body: "9/19 출시에는 웹과 Android만 제공됩니다. Windows / Desktop 버전은 9/19 출시에서 제공되지 않습니다. 웹 앱이 정식 화면이며 Android는 Google Play를 통해 제공됩니다.",
			cta: "웹 앱 열기",
		},
		es: {
			title: "Obtener Tastile",
			body: "En el lanzamiento del 9/19 solo se ofrecen Web y Android. No hay cliente Windows ni Desktop en el lanzamiento. La aplicación web es la superficie oficial; Android se ofrece a través de Google Play.",
			cta: "Abrir la aplicación web",
		},
	};

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
	const intro = INTRO[lang as (typeof SUPPORTED_LANGS)[number]];

	return (
		<div className="min-h-dvh bg-background flex flex-col">
			<SiteHeader translations={getHeaderTranslations(lang)} />
			<main className="flex-1">
				<div className="layout-shell max-w-4xl py-20">
					<div>
						<div className="flex items-center gap-4">
							<TastileLogo className="h-10 w-auto text-foreground" />
							<h1 className="text-4xl font-[510] tracking-[-0.03em] text-foreground">
								{intro.title}
							</h1>
						</div>
						<p className="mt-4 text-lg text-foreground-muted">{intro.body}</p>
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
							{intro.cta}
						</Button>
					</div>
				</div>
			</main>
			<SiteFooter translations={getFooterTranslations(lang)} locale={lang} />
		</div>
	);
}
