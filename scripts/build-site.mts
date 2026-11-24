#!/usr/bin/env bun
/**
 * scripts/build-site.mts — NF04-W05 (tastile-web#256)
 *
 * Builds the static product site into `site/dist/` for Cloudflare Pages
 * Free hosting. The static site carries the public marketing surface
 * (landing, pricing, download, legal pages) so product information stays
 * available even when the Core API / Next.js app is down.
 *
 * Boundary (see site/README.md and docs/decisions.md):
 *   - Static (this script): /, /pricing, /download, /privacy, /terms,
 *     /tokushoho — pure content, no session, no Core API.
 *   - Next.js app (unchanged): /login, /auth/*, /dashboard, /app, /cli,
 *     /docs/api, /api/* — anything that needs auth, billing, or Core.
 *
 * The generator reuses the real page components and i18n dictionaries via
 * `react-dom/server` `renderToStaticMarkup`. `next/*` imports are shimmed
 * with a Bun plugin because the pages are rendered outside the Next.js
 * request pipeline. Copy therefore cannot drift from `src/`.
 *
 * Usage:
 *   bun run site:build            # write site/dist/
 *   TASTILE_SITE_APP_ORIGIN=... bun run site:build
 *   bun run site:deploy           # build + `wrangler pages deploy`
 */

import { mkdirSync, readFileSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { themeScript } from "../src/lib/theme-script";
import { translations } from "../src/shared/i18n/translations";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_DIR = join(REPO_ROOT, "site");
const DIST_DIR = join(SITE_DIR, "dist");
const BUILD_DIR = join(SITE_DIR, ".build");

// Origin of the Next.js app deployment. App-only paths (/login, /dashboard,
// /api/*, ...) are rewritten to this origin so the static site never has to
// serve them. Override per environment at build time.
const APP_ORIGIN = (
	process.env.TASTILE_SITE_APP_ORIGIN ?? "https://app.tastile.app"
).replace(/\/+$/, "");

const ALL_LOCALES = ["en", "ja", "zh-CN", "ko", "es"] as const;
type SiteLocale = (typeof ALL_LOCALES)[number];

type PageSpec = {
	/** URL path segment under the locale prefix. "" means the locale home. */
	key: string;
	/** Route path used for canonical links and ?lang= resolution. */
	route: string;
	/** Module path relative to repo root. */
	module: string;
	/** Locales that have real localized content. Others still render (the
	 *  dictionaries fall back to en) so chrome stays consistent with the app. */
	localized: boolean;
	/** Locales for which per-locale directories are emitted. */
	locales: readonly SiteLocale[];
};

const PAGES: readonly PageSpec[] = [
	{
		key: "",
		route: "/",
		module: "src/app/page.tsx",
		localized: true,
		locales: ALL_LOCALES,
	},
	{
		key: "pricing",
		route: "/pricing",
		module: "src/app/pricing/page.tsx",
		localized: true,
		locales: ALL_LOCALES,
	},
	{
		key: "download",
		route: "/download",
		module: "src/app/download/page.tsx",
		localized: true,
		locales: ALL_LOCALES,
	},
	// Legal pages are English-only in the app (PAGE_LOCALE = "en"); the static
	// site mirrors that — a single canonical file per page.
	{
		key: "privacy",
		route: "/privacy",
		module: "src/app/privacy/page.tsx",
		localized: false,
		locales: ["en"],
	},
	{
		key: "terms",
		route: "/terms",
		module: "src/app/terms/page.tsx",
		localized: false,
		locales: ["en"],
	},
	{
		key: "tokushoho",
		route: "/tokushoho",
		module: "src/app/tokushoho/page.tsx",
		localized: false,
		locales: ["en"],
	},
];

// App-only prefixes that must never be served by the static site. Mirrored
// by the _redirects file generated below.
const APP_PREFIXES = [
	"/login",
	"/app",
	"/auth",
	"/dashboard",
	"/cli",
	"/docs",
	"/api",
	"/account",
] as const;

// ---------------------------------------------------------------------------
// Bun plugin: shim the Next.js-specific imports used by the page components.
// Registered before any page module is (dynamically) imported.
// ---------------------------------------------------------------------------

Bun.plugin({
	name: "tastile-site-shims",
	setup(build) {
		build.module("next/link", () => ({
			contents: `import React from "react";
export default function Link(props) {
  const { href, children, prefetch, replace, scroll, shallow, locale, passHref, legacyBehavior, onNavigate, ...rest } = props;
  return React.createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children);
}`,
		}));
		build.module("next/navigation", () => ({
			contents: `export function usePathname() { return globalThis.__SITE_PATH__ ?? "/"; }
export function useRouter() { return { push() {}, replace() {}, prefetch() {}, back() {} }; }
export function useSearchParams() { return new URLSearchParams(); }
export function useParams() { return {}; }
export function redirect(url) { throw new Error("redirect:" + url); }
export function notFound() { throw new Error("notFound"); }`,
		}));
		build.module("next/headers", () => ({
			contents: `export async function cookies() { return { get() { return undefined; }, getAll() { return []; } }; }
export async function headers() { return { get() { return null; } }; }`,
		}));
		// CSS imports (e.g. marketing.css loaded by LandingPage) are compiled
		// separately; stub them out for the render pass.
		build.onResolve({ filter: /\.css$/ }, (args) => ({
			path: args.path,
			namespace: "site-css-stub",
		}));
		build.onLoad({ filter: /.*/, namespace: "site-css-stub" }, () => ({
			contents: "export default {};",
		}));
	},
});

// ---------------------------------------------------------------------------
// Small i18n lookup mirroring use-translation.ts / server-translations.ts.
// ---------------------------------------------------------------------------

type Dict = Record<string, unknown>;

function lookup(tree: unknown, segments: string[]): string | undefined {
	let value: unknown = tree;
	for (const key of segments) {
		if (value && typeof value === "object" && key in (value as Dict)) {
			value = (value as Dict)[key];
		} else {
			return undefined;
		}
	}
	return typeof value === "string" ? value : undefined;
}

function t(locale: SiteLocale, key: string): string {
	const record = translations as unknown as Record<SiteLocale, Dict>;
	return (
		lookup(record[locale], key.split(".")) ??
		lookup(record.en, key.split(".")) ??
		""
	);
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function pageHref(spec: PageSpec, locale: SiteLocale): string {
	if (!spec.localized) return `/${spec.key}/`;
	if (locale === "en") return spec.key === "" ? "/" : `/${spec.key}/`;
	return spec.key === "" ? `/${locale}/` : `/${locale}/${spec.key}/`;
}

function canonicalPath(spec: PageSpec): string {
	return spec.key === "" ? "/" : `/${spec.key}/`;
}

function pageFromPath(pathname: string): PageSpec | undefined {
	const normalized = pathname.replace(/\/+$/, "") || "/";
	return PAGES.find((p) => p.route === normalized);
}

function normalizeLocale(raw: string): SiteLocale {
	const value = raw.toLowerCase();
	if (value.startsWith("zh")) return "zh-CN";
	if (value.startsWith("ja")) return "ja";
	if (value.startsWith("ko")) return "ko";
	if (value.startsWith("es")) return "es";
	return "en";
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// HTML post-processing
// ---------------------------------------------------------------------------

const MENU_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu size-5" aria-hidden="true"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path></svg>`;

/**
 * The SSR pass renders SiteHeaderMobileNav's trigger <button>, but the Mantine
 * Drawer never opens without JS. Replace the dead button with a <details>
 * disclosure that works without any script. Injected links use canonical
 * hrefs and are rewritten by rewriteHrefs like every other link.
 */
function replaceMobileNav(html: string, spec: PageSpec, locale: SiteLocale): string {
	const openAria = t(locale, "nav.openMenuAria") || "Menu";
	const links: Array<{ href: string; label: string; primary?: boolean }> = [
		{ href: "/pricing", label: t(locale, "marketing.nav.pricing") },
		{ href: "/download", label: t(locale, "marketing.nav.download") },
		{ href: "/login", label: t(locale, "marketing.nav.login") },
		{
			href: "/login",
			label: t(locale, "marketing.nav.getStarted"),
			primary: true,
		},
	];
	const items = links
		.map(
			(link) =>
				`<a href="${link.href}" class="${
					link.primary
						? "mt-2 rounded-full bg-foreground px-4 py-2 text-center text-sm font-medium text-background hover:bg-interactive-hover"
						: "rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground"
				}">${escapeHtml(link.label)}</a>`,
		)
		.join("");
	const disclosure =
		`<details class="mkt-mobile-nav sm:hidden">` +
		`<summary aria-label="${escapeHtml(openAria)}" class="mkt-mobile-nav-summary inline-flex items-center justify-center rounded-md p-1.5 text-foreground-muted hover:bg-surface-2 hover:text-foreground">${MENU_SVG}</summary>` +
		`<nav class="mkt-mobile-nav-panel flex flex-col gap-1">${items}</nav>` +
		`</details>`;
	// The trigger is the only <button> carrying the `sm:hidden` utility inside
	// the header; match it non-greedily up to its own </button>.
	return html.replace(/<button[^>]*sm:hidden[^>]*>[\s\S]*?<\/button>/, disclosure);
}

/**
 * Rewrite internal hrefs for the static site:
 *   - `?lang=` links (LocaleSwitcher output) -> locale path of the same page,
 *     falling back to the locale home for English-only pages.
 *   - App-only paths (/login, /dashboard, /api/*, ...) -> APP_ORIGIN.
 *   - Marketing page paths -> the locale-appropriate static path.
 */
function rewriteHrefs(html: string, spec: PageSpec, locale: SiteLocale): string {
	// Pass 1: canonical internal links. The `?` exclusion keeps `?lang=`
	// switcher links untouched for pass 2.
	let out = html.replace(/href="(\/[^"?#]*)"/g, (_m, path: string) => {
		const normalized = path.replace(/\/+$/, "") || "/";

		if (APP_PREFIXES.some((p) => normalized === p || normalized.startsWith(`${p}/`))) {
			return `href="${APP_ORIGIN}${normalized}"`;
		}

		const linked = PAGES.find((p) => p.route === normalized);
		if (linked) {
			return `href="${pageHref(linked, locale)}"`;
		}

		// Unknown root-relative path: it was served by the Next.js app before,
		// so keep it working by pointing at the app origin.
		return `href="${APP_ORIGIN}${normalized}"`;
	});

	// Pass 2: `?lang=` switcher links, resolved LAST so the locale-prefixed
	// targets they produce are never re-scanned. The pathname always equals
	// the canonical route because __SITE_PATH__ is pinned during render.
	out = out.replace(/href="(\/[^"]*?)\?lang=([A-Za-z-]+)"/g, (_m, path: string, rawLang: string) => {
		const target = normalizeLocale(rawLang);
		const linked = pageFromPath(path);
		const effective = linked ?? spec;
		let href: string;
		if (effective.localized) {
			href = pageHref(effective, target);
		} else {
			href = target === "en" ? `/${effective.key}/` : `/${target}/`;
		}
		return `href="${href}"`;
	});

	return out;
}

/**
 * Client-side locale negotiation for localized pages. Mirrors the app's
 * priority chain (?lang= > NEXT_LOCALE cookie > navigator.language) and
 * redirects to the locale path when it differs from the baked locale.
 * English-only pages get no script (they are English in the app too).
 */
function localeScript(spec: PageSpec, locale: SiteLocale): string {
	if (!spec.localized) return "";
	const page = spec.key;
	return `<script>(function(){try{` +
		`var q=new URLSearchParams(location.search).get("lang");` +
		`var m=document.cookie.match(/(?:^|;\\s*)NEXT_LOCALE=([^;\\s]+)/);` +
		`var n=(navigator.languages&&navigator.languages[0])||navigator.language||"";` +
		`var raw=(q||(m&&decodeURIComponent(m[1]))||n||"").toLowerCase();` +
		`var loc=raw.indexOf("zh")===0?"zh-CN":raw.indexOf("ja")===0?"ja":raw.indexOf("ko")===0?"ko":raw.indexOf("es")===0?"es":"en";` +
		`if(loc===${JSON.stringify(locale)})return;` +
		`var page=${JSON.stringify(page)};` +
		`var href=loc==="en"?(page?"/"+page+"/":"/"):("/"+loc+"/"+(page?page+"/":""));` +
		`document.cookie="NEXT_LOCALE="+encodeURIComponent(loc)+";path=/;max-age=31536000;SameSite=Lax";` +
		`location.replace(href);` +
		`}catch(e){}})();</script>`;
}

function documentShell(opts: {
	spec: PageSpec;
	locale: SiteLocale;
	title: string;
	description: string;
	bodyHtml: string;
}): string {
	const { spec, locale, title, description, bodyHtml } = opts;
	const langAttr = locale;
	return (
		`<!doctype html>\n` +
		`<html lang="${escapeHtml(langAttr)}">\n<head>\n` +
		`<meta charset="utf-8">\n` +
		`<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
		`<title>${escapeHtml(title)}</title>\n` +
		`<meta name="description" content="${escapeHtml(description)}">\n` +
		`<link rel="icon" href="/favicon.ico" sizes="any">\n` +
		`<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">\n` +
		`<link rel="apple-touch-icon" href="/icon-192.png">\n` +
		`<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
		`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
		`<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap" rel="stylesheet">\n` +
		`<link rel="stylesheet" href="/assets/site.css">\n` +
		`<script>${themeScript}</script>\n` +
		localeScript(spec, locale) +
		`</head>\n<body class="font-sans antialiased">\n${bodyHtml}\n</body>\n</html>\n`
	);
}

// ---------------------------------------------------------------------------
// Page rendering
// ---------------------------------------------------------------------------

type PageModule = {
	default: (props?: { searchParams?: Promise<{ lang?: string }> }) => unknown;
	metadata?: { title?: string; description?: string };
};

async function renderPage(
	spec: PageSpec,
	locale: SiteLocale,
	mod: PageModule,
): Promise<string> {
	const Page = mod.default;

	// Client components (PricingCard, LocaleSwitcher, ...) read the zustand
	// locale store during SSR; pin it to the page locale before rendering.
	const { useLocaleStore } = await import(
		join(REPO_ROOT, "src/shared/stores/locale-store.ts")
	);
	useLocaleStore.setState({ locale });

	// Pin the pathname the next/navigation shim reports so ?lang= links are
	// built from the canonical route regardless of the emitted locale path.
	(globalThis as Record<string, unknown>).__SITE_PATH__ = canonicalPath(spec);

	const element = await Page({
		searchParams: Promise.resolve({ lang: locale }),
	});
	const raw = renderToStaticMarkup(
		React.createElement(MantineProvider, null, element as React.ReactElement),
	);

	// Move Mantine's inline <style> blocks into <head> via the shell.
	const styles: string[] = [];
	const bodyHtml = raw
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, (m) => {
			styles.push(m);
			return "";
		})
		.trim();

	const withNav = replaceMobileNav(bodyHtml, spec, locale);
	const rewritten = rewriteHrefs(withNav, spec, locale);

	const title =
		typeof mod.metadata?.title === "string" && mod.metadata.title
			? mod.metadata.title
			: t("en", "app.metadata.title") || "Tastile";
	const description =
		typeof mod.metadata?.description === "string" && mod.metadata.description
			? mod.metadata.description
			: t("en", "app.metadata.description") || "";

	const headExtras = styles.join("\n");
	const doc = documentShell({
		spec,
		locale,
		title,
		description,
		bodyHtml: rewritten,
	});
	// Inject extracted styles just before </head>.
	return doc.replace("</head>", `${headExtras}\n</head>`);
}

function outputPath(spec: PageSpec, locale: SiteLocale): string {
	if (spec.localized) {
		if (locale === "en") {
			return spec.key === "" ? "index.html" : `${spec.key}/index.html`;
		}
		return spec.key === ""
			? `${locale}/index.html`
			: `${locale}/${spec.key}/index.html`;
	}
	return `${spec.key}/index.html`;
}

// ---------------------------------------------------------------------------
// CSS build: reuse the app's real token/base stylesheet (globals.css minus
// its tailwind import) + marketing.css + small static-site additions, then
// compile utilities with Tailwind v4 scanning src/ and the emitted HTML.
// ---------------------------------------------------------------------------

const SITE_EXTRA_CSS = `
/* Static site additions (NF04-W05). */
.mkt-mobile-nav {
  position: relative;
}
.mkt-mobile-nav > summary {
  list-style: none;
  cursor: pointer;
  user-select: none;
}
.mkt-mobile-nav > summary::-webkit-details-marker {
  display: none;
}
.mkt-mobile-nav[open] > summary {
  background-color: var(--surface-2);
  color: var(--foreground);
}
.mkt-mobile-nav-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 0.5rem);
  z-index: 50;
  min-width: 13rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-elevated);
  box-shadow: var(--shadow-lg);
}
`;

async function buildCss(): Promise<void> {
	const globals = readFileSync(join(REPO_ROOT, "src/app/globals.css"), "utf8").replace(
		/^@import "tailwindcss";\s*/,
		"",
	);
	const marketing = readFileSync(
		join(REPO_ROOT, "src/features/marketing/ui/marketing.css"),
		"utf8",
	);
	const input =
		`@import "tailwindcss";\n` +
		`@source "../../src";\n` +
		`@source "../dist";\n` +
		`${globals}\n${marketing}\n${SITE_EXTRA_CSS}\n`;

	mkdirSync(BUILD_DIR, { recursive: true });
	const inputPath = join(BUILD_DIR, "input.css");
	writeFileSync(inputPath, input);

	const result = await postcss([tailwind()]).process(input, { from: inputPath });
	mkdirSync(join(DIST_DIR, "assets"), { recursive: true });
	writeFileSync(join(DIST_DIR, "assets/site.css"), result.css);
}

// ---------------------------------------------------------------------------
// Static assets, _headers, _redirects, 404
// ---------------------------------------------------------------------------

function copyAssets(): void {
	for (const file of ["favicon.ico", "icon-192.png", "icon-512.png"]) {
		const src = join(REPO_ROOT, "public", file);
		if (existsSync(src)) cpSync(src, join(DIST_DIR, file));
	}
}

function writeHeaders(): void {
	writeFileSync(
		join(DIST_DIR, "_headers"),
		`/*\n  Cache-Control: public, max-age=0, must-revalidate\n/assets/*\n  Cache-Control: public, max-age=3600\n`,
	);
}

function writeRedirects(): void {
	const lines = [
		"# App-only paths are served by the Next.js deployment, not the static",
		"# site. These redirects keep apex-host URLs working after the Pages",
		"# cutover. APP_ORIGIN is baked at build time (TASTILE_SITE_APP_ORIGIN).",
	];
	const push = (from: string, to: string) => lines.push(`${from} ${APP_ORIGIN}${to} 302`);
	for (const prefix of APP_PREFIXES) {
		if (prefix === "/api") {
			lines.push(`/api/* ${APP_ORIGIN}/api/:splat 302`);
			continue;
		}
		push(prefix, prefix);
		lines.push(`${prefix}/* ${APP_ORIGIN}${prefix}/:splat 302`);
	}
	writeFileSync(join(DIST_DIR, "_redirects"), `${lines.join("\n")}\n`);
}

function write404(): void {
	writeFileSync(
		join(DIST_DIR, "404.html"),
		`<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Tastile — Page not found</title>\n<link rel="stylesheet" href="/assets/site.css">\n</head>\n<body class="font-sans antialiased" style="display:flex;min-height:100dvh;align-items:center;justify-content:center;flex-direction:column;gap:1rem">\n<p style="font-size:1.25rem;font-weight:600">Page not found</p>\n<p><a href="/" style="color:var(--primary)">Back to Tastile</a></p>\n</body>\n</html>\n`,
	);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	mkdirSync(DIST_DIR, { recursive: true });

	let pageCount = 0;
	for (const spec of PAGES) {
		const mod = (await import(join(REPO_ROOT, spec.module))) as PageModule;
		for (const locale of spec.locales) {
			const html = await renderPage(spec, locale, mod);
			const rel = outputPath(spec, locale);
			const abs = join(DIST_DIR, rel);
			mkdirSync(dirname(abs), { recursive: true });
			writeFileSync(abs, html);
			pageCount += 1;
		}
	}

	await buildCss();
	copyAssets();
	writeHeaders();
	writeRedirects();
	write404();

	console.log(
		`site:build OK — ${pageCount} pages -> ${join(SITE_DIR, "dist")} (app origin: ${APP_ORIGIN})`,
	);
}

await main();
