import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchDesktopReleaseInfo } from "@/lib/desktop-release";
import { translations } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/stores/locale-store";

export const metadata = {
  title: "Download Tastile — Execution Control",
  description: "Download Tastile for Windows. Start controlling your execution today.",
};

export default async function DownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: Locale = params.lang === "en" ? "en" : "ja";
  const t = translations[lang].marketing.download;
  const release = await fetchDesktopReleaseInfo();
  const version = release?.latestVersion ?? "latest";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader showFeatureLink />
      <main className="flex-1">
      <div className="layout-shell max-w-4xl py-20">
        <div>
          <h1 className="text-4xl font-[510] tracking-[-0.03em] text-foreground">
            {t.title}
          </h1>
          <p className="mt-4 text-lg text-foreground-muted">
            {t.subtitle}
          </p>
        </div>

        <div className="mt-12 flex flex-col items-start">
          {/* Direct Download */}
          <a
            href="/api/download/windows"
            className="flex items-center gap-3 rounded-full bg-primary px-8 py-4 text-lg font-medium text-primary-fg hover:bg-primary-hover"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 20h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V6H3v2zm0-6v2h18V2H3z"/>
            </svg>
            {t.downloadButton}
          </a>
          <p className="mt-3 text-sm text-foreground-muted">
            {t.version} {version}
          </p>

          {/* Microsoft Store Badge */}
          <div className="mt-8">
            <p className="mb-4 text-sm text-foreground-muted">{t.alsoAvailable}</p>
            <a
              href="#"
              className="inline-block opacity-50 cursor-not-allowed"
              title={t.comingSoon}
            >
              <div className="flex items-center gap-2 rounded-full bg-surface-elevated px-6 py-3 text-foreground">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"/>
                </svg>
                <span className="font-semibold">{t.microsoftStore}</span>
              </div>
            </a>
          </div>
        </div>

        {/* System Requirements */}
        <div className="mt-16 rounded-xl bg-surface-elevated p-8">
          <h2 className="mb-4 text-xl font-[590] text-foreground">
            {t.systemRequirements}
          </h2>
          <ul className="space-y-2 text-foreground-muted">
            {t.requirements.map((req, i) => (
              <li key={i} className="flex items-center gap-2">
                <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {req}
              </li>
            ))}
          </ul>
        </div>

        {/* Web Alternative */}
        <div className="mt-8">
          <p className="text-foreground-muted">
            {t.webAlternative}
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-full bg-surface-1 px-6 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
          >
            {t.openWebApp}
          </Link>
        </div>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}
