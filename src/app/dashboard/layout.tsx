import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check plan - Pro required for dashboard
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  if (profile?.plan !== 'pro') {
    redirect('/app/now')
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
          <div className="p-4">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Tastile Pro</span>
          </div>
          <nav className="px-2 space-y-1">
            <a
              href="/dashboard"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Overview
            </a>
            <a
              href="/dashboard/tiles"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Tiles
            </a>
            <a
              href="/dashboard/history"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              History
            </a>
            <a
              href="/dashboard/settings"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Settings
            </a>
            <a
              href="/dashboard/billing"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Billing
            </a>
          </nav>
          <div className="mt-8 px-4">
            <a
              href="/app/now"
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← Back to App
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
