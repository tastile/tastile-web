import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchDesktopReleaseInfo } from "@/lib/desktop-release";

export const metadata = {
  title: "Download Tastile — Execution Control",
  description: "Download Tastile for Windows. Start controlling your execution today.",
};

export default async function DownloadPage() {
  const release = await fetchDesktopReleaseInfo();
  const version = release?.latestVersion ?? "latest";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader showFeatureLink />
      <main className="flex-1">
      <div className="layout-shell max-w-4xl py-20">
        <div className="layout-grid-2 items-start gap-8">
          <div>
          <h1 className="text-4xl font-[510] tracking-[-0.03em] text-foreground">
            Download Tastile for Windows
          </h1>
          <p className="mt-4 text-lg text-foreground-muted">
            Get the desktop app for the best execution control experience.
          </p>
          </div>
          <aside className="rounded-xl border border-border bg-surface-elevated p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground-subtle">Release Track</p>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              直近版を左で選んで 右は配布チャネルの説明に限定する  
              視線を分散させずダウンロード行動を優先する
            </p>
          </aside>
        </div>

        <div className="mt-12 flex flex-col items-start">
          {/* Direct Download */}
          <a
            href="/api/download/windows"
            className="flex items-center gap-3 rounded-md bg-primary px-8 py-4 text-lg font-medium text-primary-fg hover:bg-primary-hover"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 20h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V6H3v2zm0-6v2h18V2H3z"/>
            </svg>
            Download for Windows (64-bit)
          </a>
          <p className="mt-3 text-sm text-foreground-muted">
            Version {version}
          </p>

          {/* Microsoft Store Badge */}
          <div className="mt-8">
            <p className="mb-4 text-sm text-foreground-muted">Also available on</p>
            <a 
              href="#" 
              className="inline-block opacity-50 cursor-not-allowed"
              title="Coming soon to Microsoft Store"
            >
              <div className="flex items-center gap-2 rounded-md bg-surface-elevated px-6 py-3 text-foreground">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"/>
                </svg>
                <span className="font-semibold">Microsoft Store</span>
              </div>
            </a>
          </div>
        </div>

        {/* System Requirements */}
        <div className="mt-16 rounded-xl border border-border bg-surface-elevated p-8">
          <h2 className="mb-4 text-xl font-[590] text-foreground">
            System Requirements
          </h2>
          <ul className="space-y-2 text-foreground-muted">
            <li className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Windows 10 version 19041.0 or higher
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Windows 11 supported
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              x64 architecture
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Internet connection for sync features
            </li>
          </ul>
        </div>

        {/* Web Alternative */}
        <div className="mt-8">
          <p className="text-foreground-muted">
            Or use Tastile on the web — no download required.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-md border border-border bg-surface-1 px-6 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
          >
            Open Web App
          </Link>
        </div>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}
