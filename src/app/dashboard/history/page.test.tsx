/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HistoryPage from './page'
import { TileId } from '@/lib/domain/ids'

vi.mock('@/lib/hooks/execution-engine-context', () => ({
  useExecutionEngineContext: () => ({
    loading: false,
    execute: vi.fn(),
    state: {
      tiles: new Map(),
      execution: {
        activeTileId: null,
        phaseKind: 'idle',
        phaseStartedAt: null,
        phaseEndsAt: null,
        pendingPrompt: null,
      },
      timeline: [
        {
          id: 'seg-1',
          tileId: TileId.fromString('tile-1'),
          title: 'Write docs',
          type: 'work',
          status: 'done',
          startAt: new Date(),
          endAt: new Date(),
        },
      ],
      events: [],
    },
  }),
}))

describe('HistoryPage', () => {
  it('uses daemon timeline projection for history events', () => {
    render(<HistoryPage />)
    expect(screen.getByText(/work_started/i)).toBeTruthy()
    expect(screen.getByText(/work_ended/i)).toBeTruthy()
  })
})
