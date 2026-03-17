'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useDialogStore } from '@/lib/stores/dialog-store'
import { getCurrentLocalDate, getCurrentLocalTime, parseDateTimeParts } from '@/lib/utils/tile-formatters'
import { cn } from '@/lib/utils/cn'

interface DeferTileDialogProps {
  onConfirm: (tileId: string, nextStartAt: Date) => void
}

export function DeferTileDialog({ onConfirm }: DeferTileDialogProps) {
  const { t } = useTranslation()
  const { deferDialog, closeDeferDialog } = useDialogStore()
  const [datePart, setDatePart] = useState('')
  const [timePart, setTimePart] = useState('')

  // Initialize with current date/time when dialog opens
  useEffect(() => {
    if (deferDialog.open) {
      setDatePart(getCurrentLocalDate())
      setTimePart(getCurrentLocalTime())
    }
  }, [deferDialog.open])

  if (!deferDialog.open || !deferDialog.tile) return null

  const handleConfirm = () => {
    if (!deferDialog.tile) return

    const nextStartAt = parseDateTimeParts(datePart, timePart)
    if (!nextStartAt) {
      alert('Invalid date/time')
      return
    }

    onConfirm(deferDialog.tile.core.id, nextStartAt)
    closeDeferDialog()
  }

  const handleCancel = () => {
    closeDeferDialog()
  }

  const title = deferDialog.mode === 'defer' ? t('tiles.dialogs.deferTitle') : t('tiles.dialogs.interruptTitle')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCancel}>
      <div
        className="w-full max-w-md rounded-xl bg-surface-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg p-1 text-foreground-muted hover:bg-surface-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tile info */}
        <div className="mb-4">
          <p className="text-sm text-foreground">{deferDialog.tile.core.title}</p>
          {deferDialog.tile.core.nextAction && (
            <p className="mt-1 text-xs text-foreground-muted">{deferDialog.tile.core.nextAction}</p>
          )}
        </div>

        {/* Date/Time inputs */}
        <div className="mb-6 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-foreground-muted">{t('tiles.dialogs.nextStartAt')}</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={datePart}
                onChange={(e) => setDatePart(e.target.value)}
                className="flex-1 rounded-lg border border-surface-2 bg-surface-1 px-3 py-2 text-sm text-foreground"
              />
              <input
                type="time"
                value={timePart}
                onChange={(e) => setTimePart(e.target.value)}
                className="flex-1 rounded-lg border border-surface-2 bg-surface-1 px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-1"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:bg-primary/90"
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
