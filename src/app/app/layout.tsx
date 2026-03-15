import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountMenu } from './account-menu'
import { LayoutDashboard, CalendarDays, Layers, Settings, ListTodo, Calendar } from 'lucide-react'

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

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User'
  const plan = profile?.plan || 'free'

  return (
    <div className="min-h-screen bg-white flex">
      {/* Desktop Sidebar - hidden on mobile/tablet */}
      <aside className="hidden lg:flex flex-col justify-between w-[220px] shrink-0 bg-[#FAFAFA] border-r border-zinc-100 p-5">
        <div className="space-y-7">
          <span className="font-[family-name:var(--font-outfit)] text-[22px] font-extrabold text-black">
            Tastile
          </span>
          <nav className="flex flex-col gap-1">
            <a href="/app/now" className="flex items-center gap-2.5 rounded-[10px] bg-black text-white text-sm font-semibold px-3 h-10">
              <LayoutDashboard size={16} />
              Today
            </a>
            <a href="/app/now" className="flex items-center gap-2.5 rounded-[10px] text-zinc-500 text-sm font-medium px-3 h-10 hover:bg-zinc-100">
              <CalendarDays size={16} />
              Timeline
            </a>
            <a href="/app/now" className="flex items-center gap-2.5 rounded-[10px] text-zinc-500 text-sm font-medium px-3 h-10 hover:bg-zinc-100">
              <Layers size={16} />
              All Tiles
            </a>
            <a href="/app/now" className="flex items-center gap-2.5 rounded-[10px] text-zinc-500 text-sm font-medium px-3 h-10 hover:bg-zinc-100">
              <Settings size={16} />
              Settings
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          <AccountMenu
            displayName={displayName}
            avatarUrl={profile?.avatar_url}
            plan={plan}
            email={user.email || ''}
          />
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-outfit)] text-[13px] font-bold text-black truncate">{displayName}</p>
            <p className="text-[11px] text-zinc-500">{plan === 'pro' ? 'Pro' : 'Free'}</p>
          </div>
        </div>
      </aside>

      {/* Mobile/Tablet Header - hidden on desktop */}
      <div className="lg:hidden flex flex-col w-full">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-12 px-5 border-b border-zinc-100">
          <span className="font-[family-name:var(--font-outfit)] text-[20px] font-extrabold text-black">
            Tastile
          </span>
          <div className="flex items-center gap-3">
            <a href="/app/now" className="text-zinc-400 hover:text-black">
              <ListTodo size={18} />
            </a>
            <a href="/app/now" className="text-zinc-400 hover:text-black">
              <Calendar size={18} />
            </a>
            <AccountMenu
              displayName={displayName}
              avatarUrl={profile?.avatar_url}
              plan={plan}
              email={user.email || ''}
            />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Desktop Content Area - hidden on mobile */}
      <main className="hidden lg:flex flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
