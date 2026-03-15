'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Tile {
  id: string
  title: string
  lifecycle: string
  updated_at: string
}

export default function NowPage() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadTiles()
  }, [])

  async function loadTiles() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('tiles')
      .select('id, title, lifecycle, updated_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(20)

    setTiles(data || [])
    setLoading(false)
  }

  async function createTile(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('tiles')
      .insert({
        user_id: user.id,
        local_tile_id: crypto.randomUUID(),
        title: newTitle.trim(),
        lifecycle: 'Ready'
      })

    if (!error) {
      setNewTitle('')
      loadTiles()
    }
  }

  async function startTile(tileId: string) {
    const { error } = await supabase
      .from('tiles')
      .update({ lifecycle: 'Started', updated_at: new Date().toISOString() })
      .eq('id', tileId)

    if (!error) loadTiles()
  }

  async function completeTile(tileId: string) {
    const { error } = await supabase
      .from('tiles')
      .update({ lifecycle: 'Done', updated_at: new Date().toISOString() })
      .eq('id', tileId)

    if (!error) loadTiles()
  }

  const activeTile = tiles.find(t => t.lifecycle === 'Started')

  return (
    <div className="space-y-6">
      {/* Create Tile */}
      <form onSubmit={createTile} className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New tile title..."
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900"
        >
          Add
        </button>
      </form>

      {/* Active Tile */}
      {activeTile && (
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase">Active</span>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{activeTile.title}</h3>
            </div>
            <button
              onClick={() => completeTile(activeTile.id)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Complete
            </button>
          </div>
        </div>
      )}

      {/* Tile List */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Tiles</h2>
        {loading ? (
          <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
        ) : tiles.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">No tiles yet. Create one above!</p>
        ) : (
          <div className="space-y-2">
            {tiles.filter(t => t.lifecycle !== 'Done').map(tile => (
              <div
                key={tile.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
              >
                <span className="text-zinc-900 dark:text-zinc-100">{tile.title}</span>
                {tile.lifecycle === 'Ready' && (
                  <button
                    onClick={() => startTile(tile.id)}
                    className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Start
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
