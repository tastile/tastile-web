import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountMenu } from './account-menu'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, plan')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Tastile</span>
          <nav className="flex gap-4 text-sm items-center">
            <a href="/app/now" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Now</a>
            <a href="/app/prompt" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Prompt</a>
            <a href="/app/memo" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Memo</a>
            <AccountMenu
              displayName={profile?.display_name || user.email || 'User'}
              avatarUrl={profile?.avatar_url}
              plan={profile?.plan || 'free'}
              email={user.email || ''}
            />
          </nav>
        </div>
      </header>
      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
