'use client'

import Link from 'next/link'
import { useExecutionEngineContext } from '@/lib/hooks/execution-engine-context'

export default function PromptPage() {
  const { state, loading } = useExecutionEngineContext()
  const prompt = state.execution.pendingPrompt

  if (loading) {
    return <p className="text-foreground-muted">Loading...</p>
  }

  if (!prompt) {
    return (
      <div className="py-12 text-center">
        <p className="text-foreground-muted">No pending prompts</p>
        <p className="mt-2 text-sm text-foreground-subtle">
          Prompts appear when the daemon needs a decision.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-[590] text-foreground">Pending Prompt</h1>
      <div className="rounded-xl bg-surface-elevated p-4">
        <p className="text-sm font-medium text-foreground">{prompt.title}</p>
        <p className="mt-2 text-foreground-muted">{prompt.body}</p>
        {prompt.why ? (
          <p className="mt-3 text-sm text-foreground-subtle">{prompt.why}</p>
        ) : null}
        <Link
          href="/dashboard"
          className="mt-4 inline-flex rounded-md bg-surface-1 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
        >
          Open dashboard
        </Link>
      </div>
    </div>
  )
}
