import type { Locale } from "@/shared/stores/locale-store";

// Page-level metadata for the public marketing pages. Kept separate from
// the marketing bundle (which is WIP) so download/pricing can move
// independently. Falls through to English for non en/ja locales via the
// translations store.
//
// W06 (2026-09-19 free launch): the 9/19 release ships Web and Android
// only. All download/pricing metadata references that surface so SEO /
// social cards do not advertise Windows / Desktop / Mac / iOS.
export const metadata = {
	en: {
		metadata: {
			download: {
				title: "Get Tastile — Free at the 9/19 launch",
				description:
					"Tastile is free on the web and Android at launch. No Windows or Desktop client ships with the 9/19 release.",
			},
			pricing: {
				title: "Pricing — Tastile",
				description: "Free at the 9/19 launch. Web and Android only; no paid plan.",
			},
			floatingSchedule: {
				requiredMinutes: "Required time: {minutes} min",
				availableWindow: "Available window: {title}",
			},
		},
	},
	ja: {
		metadata: {
			download: {
				title: "Tastile を入手 — 9/19 無料公開",
				description:
					"9/19 リリースでは Web と Android のみ提供します。Windows / Desktop クライアントは同梱しません。",
			},
			pricing: {
				title: "料金 — Tastile",
				description:
					"9/19 リリースは無料のみ。Web と Android のみで、有料プランはありません。",
			},
			floatingSchedule: {
				requiredMinutes: "所要時間: {minutes} 分",
				availableWindow: "配置可能な時間枠: {title}",
			},
		},
	},
	"zh-CN": {
		metadata: {
			download: {
				title: "获取 Tastile — 9/19 上线时免费",
				description:
					"Tastile 在 9/19 上线时仅提供 Web 和 Android 版本，不包含 Windows 或桌面客户端。",
			},
			pricing: {
				title: "价格 — Tastile",
				description: "9/19 上线时免费。仅支持 Web 和 Android；暂无付费方案。",
			},
			floatingSchedule: {
				requiredMinutes: "所需时间：{minutes} 分钟",
				availableWindow: "可用时间段：{title}",
			},
		},
	},
	ko: {
		metadata: {
			download: {
				title: "Tastile 받기 — 9/19 출시 시 무료",
				description:
					"Tastile은 9/19 출시 시 Web과 Android만 제공됩니다. Windows 또는 데스크톱 클라이언트는 포함되지 않습니다.",
			},
			pricing: {
				title: "요금 — Tastile",
				description: "9/19 출시 시 무료입니다. Web 및 Android만 제공되며 유료 요금제는 없습니다.",
			},
			floatingSchedule: {
				requiredMinutes: "필요 시간: {minutes}분",
				availableWindow: "사용 가능한 시간대: {title}",
			},
		},
	},
	es: {
		metadata: {
			download: {
				title: "Obtener Tastile — Gratis en el lanzamiento del 19/9",
				description:
					"Tastile se lanza el 19/9 solo para Web y Android. No incluye cliente para Windows ni escritorio.",
			},
			pricing: {
				title: "Precios — Tastile",
				description: "Gratis en el lanzamiento del 19/9. Solo Web y Android; sin plan de pago.",
			},
			floatingSchedule: {
				requiredMinutes: "Tiempo necesario: {minutes} min",
				availableWindow: "Franja disponible: {title}",
			},
		},
	},
} satisfies Record<Locale, Record<string, unknown>>;
