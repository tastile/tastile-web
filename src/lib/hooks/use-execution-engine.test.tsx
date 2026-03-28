/** @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useExecutionEngine } from './use-execution-engine'

const {
  getUserMock,
  getBrowserAccessTokenMock,
  readSnapshotMock,
  openExecutionStreamMock,
  sendCommandMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getBrowserAccessTokenMock: vi.fn(),
  readSnapshotMock: vi.fn(),
  openExecutionStreamMock: vi.fn(() => ({ close: vi.fn() })),
  sendCommandMock: vi.fn(),
}))
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
  }),
  getBrowserAccessToken: getBrowserAccessTokenMock,
}))

vi.mock('../daemon/client', () => ({
  DaemonClient: class {
    readSnapshot = readSnapshotMock
    sendCommand = sendCommandMock
  },
}))

vi.mock('../daemon/stream', () => ({
  openExecutionStream: openExecutionStreamMock,
}))

function Probe() {
  const { loading } = useExecutionEngine()
  return <div data-testid="loading">{loading ? 'yes' : 'no'}</div>
}

describe('useExecutionEngine', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    getBrowserAccessTokenMock.mockReset()
    readSnapshotMock.mockReset()
    sendCommandMock.mockReset()
    openExecutionStreamMock.mockClear()
    consoleErrorSpy.mockClear()
  })

  it('stops loading when initial event replay fails', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    getBrowserAccessTokenMock.mockResolvedValue('token-1')
    readSnapshotMock.mockRejectedValue(new Error('boom'))

    render(<Probe />)

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('no')
    })
  })
})
