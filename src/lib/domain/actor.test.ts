import { describe, it, expect } from 'vitest'
import { Actor } from './actor'

describe('Actor', () => {
  it('should create system actor', () => {
    const actor = Actor.system()
    expect(actor.type).toBe('system')
    expect(actor.id).toBe('system')
  })

  it('should create human actor', () => {
    const actor = Actor.human('user-123')
    expect(actor.type).toBe('human')
    expect(actor.id).toBe('user-123')
  })

  it('should create agent actor', () => {
    const actor = Actor.agent('claude-1')
    expect(actor.type).toBe('agent')
    expect(actor.id).toBe('claude-1')
  })
})
