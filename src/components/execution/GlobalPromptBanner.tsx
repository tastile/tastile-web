'use client'

import { PendingPrompt, PromptAction } from '@/lib/domain/execution'
import { useTranslation } from '@/lib/i18n/use-translation'

interface GlobalPromptBannerProps {
  prompt: PendingPrompt | null
  onAction?: (action: PromptAction) => void
  onDismiss?: () => void
}

const PROMPT_TITLE: Record<PendingPrompt['kind'], string> = {
  start_tile: 'Start tile',
  end_tile: 'End tile',
  end_break: 'End break',
}

const SEVERITY_STYLE: Record<NonNullable<PendingPrompt['severity']>, string> = {
  soft: 'border-primary/30 bg-surface-elevated',
  elevated: 'border-amber-500/40 bg-amber-500/10',
  critical: 'border-rose-500/45 bg-rose-500/10',
}

export function GlobalPromptBanner({ prompt, onAction, onDismiss }: GlobalPromptBannerProps) {
  const { t } = useTranslation()
  if (!prompt) return null

  const visibleActions = prompt.actions.filter(action => action !== 'dismiss')
  const canDismiss = prompt.actions.includes('dismiss') && typeof onDismiss === 'function'
  const title = prompt.title?.trim() || PROMPT_TITLE[prompt.kind]
  const body = prompt.body?.trim() || prompt.reason
  const why = prompt.why?.trim() || null

  return (
    <div
      className={`fixed top-3 left-1/2 z-[70] w-[min(96vw,820px)] -translate-x-1/2 rounded-2xl border p-4 shadow-xl backdrop-blur ${SEVERITY_STYLE[prompt.severity]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-1 text-sm text-foreground-muted">{body}</div>
          {why ? <div className="mt-1 text-xs text-foreground-muted/80">{why}</div> : null}
        </div>
        {canDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-surface-2"
          >
            {t('common.close')}
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {visibleActions.map(action => (
          <button
            key={action}
            type="button"
            onClick={() => onAction?.(action)}
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-1"
          >
            {labelForAction(action, t)}
          </button>
        ))}
      </div>
    </div>
  )
}

function labelForAction(action: PromptAction, t: (key: string) => string): string {
  switch (action) {
    case 'start_tile':
      return t('tiles.actions.start')
    case 'complete_tile':
      return t('tiles.actions.complete')
    case 'extend_phase':
      return t('prompt.actions.extend')
    case 'defer_tile':
      return t('tiles.actions.defer')
    case 'end_break':
      return t('prompt.actions.endBreak')
    case 'dismiss':
      return t('common.close')
  }
}
