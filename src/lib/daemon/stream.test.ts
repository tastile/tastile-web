import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openExecutionStream } from './stream'

type TestMessageEvent = { data: string }

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: ((event: TestMessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  closed = false

  constructor(public readonly url: string, public readonly options?: { headers?: Record<string, string> }) {
    FakeEventSource.instances.push(this)
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  emitError() {
    this.onerror?.(new Event('error'))
  }

  close() {
    this.closed = true
  }
}

describe('openExecutionStream', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
  })

  it('ignores malformed json event payloads', async () => {
    vi.useFakeTimers()
    try {
      const seenIds: string[] = []
      openExecutionStream({
        baseUrl: 'https://daemon.example',
        reconnectDelayMs: 100,
        connectImpl: async (url) => new FakeEventSource(url),
        onEvent: event => {
          seenIds.push(event.eventId)
        },
      })

      await vi.runAllTimersAsync()
      const first = FakeEventSource.instances[0]
      first.onmessage?.({ data: '{' })
      first.emitMessage({ event_id: 'evt-valid', payload: { ok: true } })

      expect(seenIds).toEqual(['evt-valid'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes token through default query param strategy', async () => {
    const OriginalEventSource = globalThis.EventSource
    const createdUrls: string[] = []
    class TestEventSource {
      onmessage: ((event: { data: string }) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      constructor(url: string | URL) {
        createdUrls.push(String(url))
      }
      close() {}
    }
    globalThis.EventSource = TestEventSource as unknown as typeof EventSource
    try {
      const stream = openExecutionStream({
        baseUrl: 'https://daemon.example',
        getAccessToken: async () => 'token-abc',
        onEvent: () => {},
      })
      await Promise.resolve()
      expect(createdUrls[0]).toContain('/execution/stream?access_token=token-abc')
      stream.close()
    } finally {
      globalThis.EventSource = OriginalEventSource
    }
  })

  it('retries when initial connect fails', async () => {
    vi.useFakeTimers()
    try {
      let attempts = 0
      const seenIds: string[] = []
      openExecutionStream({
        baseUrl: 'https://daemon.example',
        reconnectDelayMs: 50,
        connectImpl: async (url) => {
          attempts += 1
          if (attempts === 1) {
            throw new Error(`connect failed for ${url}`)
          }
          return new FakeEventSource(url)
        },
        onEvent: event => {
          seenIds.push(event.eventId)
        },
      })

      expect(attempts).toBe(1)
      await vi.advanceTimersByTimeAsync(50)
      await vi.runAllTimersAsync()
      expect(attempts).toBe(2)
      const second = FakeEventSource.instances[0]
      second.emitMessage({ event_id: 'evt-retry', payload: {} })
      expect(seenIds).toEqual(['evt-retry'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('reconnects stream and deduplicates events by eventId', async () => {
    vi.useFakeTimers()
    try {
      const seenIds: string[] = []
      openExecutionStream({
        baseUrl: 'https://daemon.example',
        getAccessToken: async () => 'token-1',
        reconnectDelayMs: 100,
        connectImpl: async (url, token) =>
          new FakeEventSource(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }),
        onEvent: event => {
          seenIds.push(event.eventId)
        },
      })

      await vi.runAllTimersAsync()
      const first = FakeEventSource.instances[0]
      first.emitMessage({ event_id: 'evt-1', payload: { n: 1 } })
      expect(seenIds).toEqual(['evt-1'])

      first.emitError()
      expect(first.closed).toBe(true)

      await vi.advanceTimersByTimeAsync(100)
      await vi.runAllTimersAsync()

      const second = FakeEventSource.instances[1]
      second.emitMessage({ event_id: 'evt-1', payload: { n: 2 } })
      second.emitMessage({ event_id: 'evt-2', payload: { n: 3 } })

      expect(seenIds).toEqual(['evt-1', 'evt-2'])
    } finally {
      vi.useRealTimers()
    }
  })
})
