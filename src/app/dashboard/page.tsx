import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get today's stats
  const today = new Date().toISOString().split('T')[0]
  const { data: todayTiles } = await supabase
    .from('tiles')
    .select('*')
    .eq('user_id', user.id)
    .gte('updated_at', today)
    .is('deleted_at', null)

  const { data: recentTiles } = await supabase
    .from('tiles')
    .select('id, title, lifecycle, updated_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(5)

  const startedToday = todayTiles?.filter(t => t.lifecycle === 'Started').length || 0
  const completedToday = todayTiles?.filter(t => t.lifecycle === 'Done').length || 0

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Started Today</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{startedToday}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Completed Today</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{completedToday}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Active Tiles</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {recentTiles?.filter(t => t.lifecycle !== 'Done').length || 0}
          </p>
        </div>
      </div>

      {/* Recent Tiles */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recent Tiles</h2>
          <Link
            href="/dashboard/tiles"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            View All →
          </Link>
        </div>
        <div className="space-y-2">
          {recentTiles?.map(tile => (
            <div
              key={tile.id}
              className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
            >
              <span className="text-zinc-900 dark:text-zinc-100">{tile.title}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                tile.lifecycle === 'Started' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : tile.lifecycle === 'Done'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              }`}>
                {tile.lifecycle}
              </span>
            </div>
          )) || <p className="text-zinc-500 dark:text-zinc-400">No tiles yet</p>}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Quick Actions</h2>
        <div className="flex gap-3">
          <Link
            href="/dashboard/tiles"
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900"
          >
            Create Tile
          </Link>
          <Link
            href="/app/now"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Start Work
          </Link>
        </div>
      </div>
    </div>
  )
}
