'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Tile {
  id: string
  title: string
}

export default function MemoPage() {
  const [memo, setMemo] = useState('')
  const [recentTiles, setRecentTiles] = useState<Tile[]>([])
  const [selectedTileId, setSelectedTileId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadRecentTiles()
    // Auto-focus textarea
    textareaRef.current?.focus()
  }, [])

  async function loadRecentTiles() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('tiles')
      .select('id, title')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(5)

    if (data) {
      setRecentTiles(data)
      // Select most recent tile by default
      if (data.length > 0 && !selectedTileId) {
        setSelectedTileId(data[0].id)
      }
    }
  }

  async function saveMemo(e: React.FormEvent) {
    e.preventDefault()
    if (!memo.trim() || !selectedTileId) return

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Save memo to tile's annotation_conditions as a simple note
    const { error } = await supabase
      .from('tiles')
      .update({
        annotation_conditions: {
          note: memo.trim(),
          noted_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedTileId)

    setSaving(false)
    if (!error) {
      setSaved(true)
      setMemo('')
      setTimeout(() => setSaved(false), 2000)
      textareaRef.current?.focus()
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Quick Memo</h1>
      
      {/* Tile Selector */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-500 dark:text-zinc-400">Attach to tile</label>
        <select
          value={selectedTileId}
          onChange={(e) => setSelectedTileId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        >
          {recentTiles.map(tile => (
            <option key={tile.id} value={tile.id}>{tile.title}</option>
          ))}
        </select>
      </div>

      {/* Memo Input */}
      <form onSubmit={saveMemo} className="space-y-3">
        <textarea
          ref={textareaRef}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Type your memo here..."
          rows={6}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className={`text-sm ${saved ? 'text-green-600 dark:text-green-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
            {saved ? 'Saved!' : saving ? 'Saving...' : `${memo.length} chars`}
          </span>
          <button
            type="submit"
            disabled={!memo.trim() || saving}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
          >
            Save Memo
          </button>
        </div>
      </form>
    </div>
  )
}
