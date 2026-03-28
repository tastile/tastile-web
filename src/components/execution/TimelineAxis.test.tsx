/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TimelineAxis } from './TimelineAxis'

describe('TimelineAxis', () => {
  it('renders absolute time axis and preserves order from daemon timeline', () => {
    render(
      <TimelineAxis
        markers={[
          { label: '09:00', topPx: 80 },
          { label: '10:00', topPx: 200 },
        ]}
        blocks={[
          {
            id: 'a',
            title: 'Deep work',
            type: 'work',
            status: 'active',
            topPx: 100,
            heightPx: 120,
            lane: 0,
            totalLanes: 1,
            startLabel: '09:30',
            endLabel: '10:30',
            durationLabel: '1h 0m',
            dateLabel: '03/26',
            timeLabel: '09:30',
            startAt: new Date('2026-03-26T09:30:00.000Z'),
            endAt: new Date('2026-03-26T10:30:00.000Z'),
          },
          {
            id: 'b',
            title: 'Break',
            type: 'break',
            status: 'scheduled',
            topPx: 240,
            heightPx: 40,
            lane: 0,
            totalLanes: 1,
            startLabel: '10:45',
            endLabel: '11:00',
            durationLabel: '15m',
            dateLabel: '03/26',
            timeLabel: '10:45',
            startAt: new Date('2026-03-26T10:45:00.000Z'),
            endAt: new Date('2026-03-26T11:00:00.000Z'),
          },
        ]}
        canvasHeightPx={600}
        nowTopPx={180}
      />
    )

    expect(screen.getByTestId('timeline-now')).toBeTruthy()
    expect(screen.getByText('09:00')).toBeTruthy()
    expect(screen.getByText('Deep work')).toBeTruthy()
    expect(screen.getByText('Break')).toBeTruthy()
  })

  it('zooms timeline canvas without changing block height', () => {
    render(
      <TimelineAxis
        markers={[{ label: '09:00', topPx: 80 }]}
        blocks={[
          {
            id: 'a',
            title: 'Deep work',
            type: 'work',
            status: 'active',
            topPx: 100,
            heightPx: 120,
            lane: 0,
            totalLanes: 1,
            startLabel: '09:30',
            endLabel: '10:30',
            durationLabel: '1h 0m',
            dateLabel: '03/26',
            timeLabel: '09:30',
            startAt: new Date('2026-03-26T09:30:00.000Z'),
            endAt: new Date('2026-03-26T10:30:00.000Z'),
          },
        ]}
        canvasHeightPx={600}
      />
    )

    const zoom = screen.getByLabelText('timeline-zoom')
    fireEvent.change(zoom, { target: { value: '2' } })
    const card = screen.getByText('Deep work').closest('div') as HTMLElement
    expect(card.style.height).toBe('120px')
  })
})
