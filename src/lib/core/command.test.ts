import { describe, it, expect } from 'vitest'
import { Command, CommandEnvelope, CreateTilePayload } from './command'
import { TileId, CommandId } from '../domain/ids'
import { Actor } from '../domain/actor'

describe('Command', () => {
  it('should create CreateTile command', () => {
    const tileId = TileId.new()
    const payload: CreateTilePayload = {
      tile_id: tileId,
      title: 'New tile',
      next_action: null,
      done_definition: null,
    }
    const cmd: Command = { type: 'create_tile', ...payload }
    expect(cmd.type).toBe('create_tile')
    expect(cmd.tile_id).toBe(tileId)
  })

  it('should wrap command in envelope', () => {
    const envelope = CommandEnvelope.create(
      { type: 'start_break', break_min: 5, reason: null, linked_tile_id: null },
      Actor.human('user-1')
    )
    expect(envelope.command_id).toBeDefined()
    expect(envelope.actor.type).toBe('human')
    expect(envelope.issued_at).toBeInstanceOf(Date)
  })
})
