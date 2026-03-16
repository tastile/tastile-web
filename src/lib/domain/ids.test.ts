import { describe, it, expect } from 'vitest';
import { TileId, EventId, CommandId, SegmentId, PromptId } from './ids';

describe('Domain IDs', () => {
  describe('TileId', () => {
    it('should generate unique TileIds', () => {
      const id1 = TileId.new();
      const id2 = TileId.new();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBe(36); // UUID format
    });

    it('should parse UUID strings to TileId', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const id = TileId.fromString(uuid);
      expect(id).toBe(uuid);
    });

    it('should validate TileId format', () => {
      expect(() => TileId.fromString('invalid')).toThrow('Invalid UUID format for TileId');
    });
  });

  describe('EventId', () => {
    it('should generate unique IDs', () => {
      const id1 = EventId.new();
      const id2 = EventId.new();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBe(36);
    });

    it('should reject invalid formats', () => {
      expect(() => EventId.fromString('invalid')).toThrow('Invalid UUID format for EventId');
    });
  });
});
