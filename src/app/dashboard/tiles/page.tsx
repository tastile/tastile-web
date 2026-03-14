'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Tile {
  id: string
  title: string
  lifecycle: string
  next_action?: string
  done_definition?: string
  updated_at: string
}

export default function TilesManagementPage() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [editingTile, setEditingTile] = useState<Tile | null>(null)
  const [newTile, setNewTile] = useState({ title: '', next_action: '', done_definition: '' })
  const supabase = createClient()

  useEffect(() => {
    loadTiles()
  }, [])

  async function loadTiles() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('tiles')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    setTiles(data || [])
    setLoading(false)
  }

  async function createTile(e: React.FormEvent) {
    e.preventDefault()
    if (!newTile.title.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('tiles')
      .insert({
        user_id: user.id,
        title: newTile.title.trim(),
        next_action: newTile.next_action.trim() || null,
        done_definition: newTile.done_definition.trim() || null,
        lifecycle: 'Ready'
      })

    if (!error) {
      setNewTile({ title: '', next_action: '', done_definition: '' })
      loadTiles()
    }
  }

  async function updateTile(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTile) return

    const { error } = await supabase
      .from('tiles')
      .update({
        title: editingTile.title,
        next_action: editingTile.next_action,
        done_definition: editingTile.done_definition,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingTile.id)

    if (!error) {
      setEditingTile(null)
      loadTiles()
    }
  }

  async function deleteTile(tileId: string) {
    const { error } = await supabase
      .from('tiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', tileId)

    if (!error) loadTiles()
  }

  const filteredTiles = filter === 'all' 
    ? tiles 
    : tiles.filter(t => t.lifecycle.toLowerCase() === filter)

  if (loading) {
    return <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Tiles</h1>

      {/* Create Tile Form */}
      <form onSubmit={createTile} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Create New Tile</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Title"
            value={newTile.title}
            onChange={(e) => setNewTile({ ...newTile, title: e.target.value })}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
          <input
            type="text"
            placeholder="Next Action (optional)"
            value={newTile.next_action}
            onChange={(e) => setNewTile({ ...newTile, next_action: e.target.value })}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
          <input
            type="text"
            placeholder="Done Definition (optional)"
            value={newTile.done_definition}
            onChange={(e) => setNewTile({ ...newTile, done_definition: e.target.value })}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={!newTile.title.trim()}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
        >
          Create Tile
        </button>
      </form>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'ready', 'started', 'done'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              filter === f
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Tiles List */}
      <div className="space-y-2">
        {filteredTiles.map(tile => (
          <div
            key={tile.id}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
          >
            {editingTile?.id === tile.id ? (
              <form onSubmit={updateTile} className="space-y-3">
                <input
                  type="text"
                  value={editingTile.title}
                  onChange={(e) => setEditingTile({ ...editingTile, title: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
                <input
                  type="text"
                  value={editingTile.next_action || ''}
                  onChange={(e) => setEditingTile({ ...editingTile, next_action: e.target.value })}
                  placeholder="Next Action"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
                <input
                  type="text"
                  value={editingTile.done_definition || ''}
                  onChange={(e) => setEditingTile({ ...editingTile, done_definition: e.target.value })}
                  placeholder="Done Definition"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTile(null)}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{tile.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tile.lifecycle === 'Started' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : tile.lifecycle === 'Done'
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}>
                      {tile.lifecycle}
                    </span>
                  </div>
                  {tile.next_action && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Next: {tile.next_action}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingTile(tile)}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTile(tile.id)}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredTiles.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">No tiles found</p>
        )}
      </div>
    </div>
  )
}
