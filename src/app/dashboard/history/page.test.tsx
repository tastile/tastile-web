import { describe, expect, it, vi } from 'vitest'
import HistoryPage from './page'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

describe('HistoryPage', () => {
  it('redirects history route to tiles changes tab', () => {
    HistoryPage()
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/tiles?tab=changes')
  })
})
