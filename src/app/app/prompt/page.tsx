'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Prompt {
  id: string
  message: string
  tile_id: string
  tile_title: string
  created_at: string
}

export default function PromptPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  const loadPrompts = useEffectEvent(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // For web, prompts are simulated based on tile state
    // In a real implementation, these would come from a prompts table
    const { data: tiles } = await supabase
      .from('tiles')
      .select('id, title, lifecycle, updated_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .eq('lifecycle', 'Started')

    // Generate prompts for long-running tiles (simulated)
    const generatedPrompts: Prompt[] = []
    if (tiles) {
      for (const tile of tiles) {
        const updatedAt = new Date(tile.updated_at)
        const now = new Date()
        const diffMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60)
        
        if (diffMinutes > 25) {
          generatedPrompts.push({
            id: `${tile.id}-continue`,
            message: `You've been working on "${tile.title}" for ${Math.floor(diffMinutes)} minutes. Continue or take a break?`,
            tile_id: tile.id,
            tile_title: tile.title,
            created_at: tile.updated_at
          })
        }
      }
    }

    setPrompts(generatedPrompts)
    setLoading(false)
  })

  useEffect(() => {
    void loadPrompts()
  }, [])

  async function respondToPrompt(promptId: string, action: 'continue' | 'break' | 'complete') {
    const prompt = prompts.find(p => p.id === promptId)
    if (!prompt) return

    if (action === 'complete') {
      await supabase
        .from('tiles')
        .update({ lifecycle: 'Done', updated_at: new Date().toISOString() })
        .eq('id', prompt.tile_id)
    } else if (action === 'break') {
      // For web, we just update the timestamp to reset the prompt
      await supabase
        .from('tiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', prompt.tile_id)
    }
    // 'continue' just dismisses the prompt

    setPrompts(current => current.filter(p => p.id !== promptId))
  }

  if (loading) {
    return <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
  }

  if (prompts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 dark:text-zinc-400">No pending prompts</p>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2">
          Prompts appear when you have been working on a tile for a while
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Pending Prompts</h1>
      
      {prompts.map(prompt => (
        <div
          key={prompt.id}
          className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4"
        >
          <p className="text-zinc-900 dark:text-zinc-100">{prompt.message}</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => respondToPrompt(prompt.id, 'continue')}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Continue
            </button>
            <button
              onClick={() => respondToPrompt(prompt.id, 'break')}
              className="rounded-lg bg-zinc-200 dark:bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600"
            >
              Take Break
            </button>
            <button
              onClick={() => respondToPrompt(prompt.id, 'complete')}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Complete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
