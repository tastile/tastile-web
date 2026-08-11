import { fetchDesktopReleaseInfo } from "@/lib/desktop-release";
import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { translations } from "@/shared/i18n/translations";
import type { Locale } from "@/shared/stores/locale-store";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";
import { TastileLogo } from "@/shared/ui/TastileLogo";
import { Button, Pill } from "@mantine/core";
import { ArrowUpRight, Download } from "lucide-react";

export const metadata = {
  title: "Download Tastile — Execution Control",
  description: "Download Tastile for Windows. Start controlling your execution today.",
};

type MarketingDownload = {
  title: string;
  subtitle: string;
  downloadButton: string;
  version: string;
  systemRequirements: string;
  requirements: string[];
  webAlternative: string;
  openWebApp: string;
};

const SUPPORTED_LANGS = ["en", "ja", "zh-CN", "ko", "es"] as const satisfies readonly Locale[];

export default async function DownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const requested = params.lang;
  const lang: Locale = (SUPPORTED_LANGS as readonly string[]).includes(requested ?? "")
    ? (requested as Locale)
    : "en";
  const t = (
    translations[lang] as {
      marketing: { download: MarketingDownload };
    }
  ).marketing.download;
  const release = await fetchDesktopReleaseInfo();
  const version = release?.latestVersion ?? "latest";

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader translations={getHeaderTranslations(lang)} />
      <main className="flex-1">
        <div className="layout-shell max-w-4xl py-20">
          <div>
            <div className="flex items-center gap-4">
              <TastileLogo className="h-10 w-auto text-foreground" />
              <h1 className="text-4xl font-[510] tracking-[-0.03em] text-foreground">{t.title}</h1>
            </div>

            <p className="mt-4 text-lg text-foreground-muted">{t.subtitle}</p>
          </div>

          <div className="mt-12 flex flex-col items-start">
            {/* Direct Download */}
            <Button
              component="a"
              href="/api/download/windows"
              download
              radius="xl"
              leftSection={<Download size={16} />}
              className="flex items-center gap-3 rounded-full bg-primary px-8 py-4 text-lg font-medium text-primary-fg hover:bg-primary-hover"
            >
              {t.downloadButton}
            </Button>
            <div>
              <p className="mt-3 text-sm text-foreground-muted">{t.version}</p>
              <Pill className="mt-2 bg-surface-1 text-foreground-subtle"> {version}</Pill>
            </div>
          </div>

          {/* System Requirements */}
          <div className="mt-16">
            <h2 className="mb-4 text-xl font-[590] text-foreground">{t.systemRequirements}</h2>
            <ul className="space-y-2 text-foreground-muted">
              {t.requirements.map((req) => (
                <li key={req} className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-success"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <title>Success</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {req}
                </li>
              ))}
            </ul>
          </div>

          {/* Web Alternative */}
          <div className="mt-8">
            <p className="text-foreground-muted">{t.webAlternative}</p>
            <Button
              variant="outline"
              radius="xl"
              rightSection={<ArrowUpRight size={16} />}
              component="a"
              href="/login"
              className="mt-4 inline-block rounded-full bg-surface-1 px-6 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
            >
              {t.openWebApp}
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter translations={getFooterTranslations(lang)} />
    </div>
  );
}
