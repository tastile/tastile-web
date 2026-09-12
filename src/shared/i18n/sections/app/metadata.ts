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
				title: "Get Tastile — Free at the 9/19 launch",
				description:
					"Tastile ships for Web and Android only at the 9/19 launch. No Windows or Desktop client is included.",
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
	ko: {
		metadata: {
			download: {
				title: "Get Tastile — Free at the 9/19 launch",
				description:
					"Tastile ships for Web and Android only at the 9/19 launch. No Windows or Desktop client is included.",
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
	es: {
		metadata: {
			download: {
				title: "Get Tastile — Free at the 9/19 launch",
				description:
					"Tastile launches for Web and Android only on 9/19. No Windows or Desktop client is included.",
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
} satisfies Record<Locale, Record<string, unknown>>;
