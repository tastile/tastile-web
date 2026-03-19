import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Download Tastile — Execution Control",
  description: "Download Tastile for Windows. Start controlling your execution today.",
};

export default function DownloadPage() {
  const version = "0.1.0";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Download Tastile for Windows
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Get the desktop app for the best execution control experience.
          </p>
        </div>

        <div className="mt-12 flex flex-col items-center">
          {/* Direct Download */}
          <a
            href="/api/download/windows"
            className="rounded-full bg-zinc-900 dark:bg-zinc-100 px-8 py-4 text-lg font-semibold text-white dark:text-zinc-900 shadow-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors flex items-center gap-3"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 20h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V6H3v2zm0-6v2h18V2H3z"/>
            </svg>
            Download for Windows (64-bit)
          </a>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Version {version}
          </p>

          {/* Microsoft Store Badge */}
          <div className="mt-8">
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-4">Also available on</p>
            <a 
              href="#" 
              className="inline-block opacity-50 cursor-not-allowed"
              title="Coming soon to Microsoft Store"
            >
              <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 rounded flex items-center gap-2">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"/>
                </svg>
                <span className="font-semibold">Microsoft Store</span>
              </div>
            </a>
          </div>
        </div>

        {/* System Requirements */}
        <div className="mt-16 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            System Requirements
          </h2>
          <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
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
        <div className="mt-8 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">
            Or use Tastile on the web — no download required.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-full border border-zinc-300 dark:border-zinc-700 px-6 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Open Web App
          </Link>
        </div>
      </div>
    </div>
  );
}
