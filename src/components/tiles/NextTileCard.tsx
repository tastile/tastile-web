'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { ChevronRight } from 'lucide-react'
import { Tile } from '@/lib/domain/tile'
import { TileId } from '@/lib/domain/ids'

interface NextTileCardProps {
  tile: Tile | null
  reason?: string
  onStart?: (tileId: TileId) => void
  loading?: boolean
}

export function NextTileCard({ tile, reason, onStart, loading = false }: NextTileCardProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="rounded-xl bg-surface-1 p-4 text-sm text-foreground-muted">
        {t('common.loading')}
      </div>
    )
  }

  if (!tile) {
    return (
      <div className="rounded-xl bg-surface-1 p-4 text-center">
        <p className="text-sm text-foreground-muted">
          {t('sidebar.noTasks') || 'タスクがありません'}
        </p>
        <p className="mt-1 text-xs text-foreground-muted">
          + ボタンをクリックしてタイルを作成
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-surface-1 p-3 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-foreground">{tile.core.title}</h4>
          {tile.core.nextAction && (
            <p className="mt-1.5 text-xs text-foreground-muted">{tile.core.nextAction}</p>
          )}
          <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1">
            <span className="text-xs font-medium text-foreground-muted">
              {reason ?? '次に着手する推奨タイル'}
            </span>
          </div>
        </div>

        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-2"
          onClick={() => onStart?.(tile.core.id)}
          aria-label="Start suggested tile"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
