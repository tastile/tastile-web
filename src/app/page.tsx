import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-6xl">
            Stop managing tasks.
            <br />
            Start controlling execution.
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Tastile is an execution control system that helps you focus on doing,
            not organizing. Create tiles, execute with intent, and track your progress.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/download"
              className="rounded-full bg-zinc-900 dark:bg-zinc-100 px-8 py-3 text-sm font-semibold text-white dark:text-zinc-900 shadow-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              Download for Windows
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-zinc-300 dark:border-zinc-700 px-8 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Try Free on Web
            </Link>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                1
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Create Tiles
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Break down your work into actionable tiles with clear next actions.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                2
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Execute
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Start tiles and focus on execution. Built-in breaks keep you fresh.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                3
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Review
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Track your history and improve your execution patterns over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-12">
            Simple Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Free */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Free</h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">For personal use</p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  100 local tiles
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  50 cloud tiles
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  30 day history
                </li>
              </ul>
              <Link
                href="/login"
                className="mt-8 block w-full rounded-full border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-100 p-8">
              <h3 className="text-xl font-semibold text-white dark:text-zinc-900">Pro</h3>
              <p className="mt-2 text-zinc-300 dark:text-zinc-600">$5/month</p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-300 dark:text-zinc-600">
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  10,000 tiles
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  2 year history
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Desktop sync
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Full dashboard
                </li>
              </ul>
              <Link
                href="/pricing"
                className="mt-8 block w-full rounded-full bg-white dark:bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            © 2026 Tastile. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              Privacy
            </Link>
            <Link href="/terms" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              Terms
            </Link>
            <Link href="/pricing" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
