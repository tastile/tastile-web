import { describe, expect, it } from 'vitest';
import { designTokens } from '../tokens';

describe('designTokens', () => {
  describe('radius', () => {
    it('matches DS v2 radius scale', () => {
      expect(designTokens.radius).toEqual({
        none: 0,
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        xxl: 32,
        xxxl: 40,
        full: 9999,
      });
    });

    it('radius gap satisfies nested-radius utility spec (radius.lg - radius.md = 4)', () => {
      expect(designTokens.radius.lg - designTokens.radius.md).toBe(4);
    });

    it('radius gap satisfies nested-radius utility spec (radius.xl - radius.lg = 8)', () => {
      expect(designTokens.radius.xl - designTokens.radius.lg).toBe(8);
    });

    it('radius gap satisfies nested-radius utility spec (radius.xxl - radius.xl = 8)', () => {
      expect(designTokens.radius.xxl - designTokens.radius.xl).toBe(8);
    });

    it('radius gap satisfies nested-radius utility spec (radius.md - radius.sm = 4)', () => {
      expect(designTokens.radius.md - designTokens.radius.sm).toBe(4);
    });

    it('radius gap satisfies nested-radius utility spec (radius.sm - radius.xs = 4)', () => {
      expect(designTokens.radius.sm - designTokens.radius.xs).toBe(4);
    });
  });

  describe('color', () => {
    it('all color values are var() references', () => {
      const all = JSON.stringify(designTokens.color);
      expect(all).toMatch(/var\(--[a-z0-9-]+\)/);
    });

    it('exposes required surface levels', () => {
      expect(designTokens.color.surface[0]).toBe('var(--surface-0)');
      expect(designTokens.color.surface[1]).toBe('var(--surface-1)');
      expect(designTokens.color.surface[2]).toBe('var(--surface-2)');
      expect(designTokens.color.surface[3]).toBe('var(--surface-3)');
    });

    it('exposes primary DEFAULT / hover / fg', () => {
      expect(designTokens.color.primary.DEFAULT).toBe('var(--primary)');
      expect(designTokens.color.primary.hover).toBe('var(--primary-hover)');
      expect(designTokens.color.primary.fg).toBe('var(--primary-foreground)');
    });
  });

  describe('spacing', () => {
    it('matches DS v2 semantic spacing scale', () => {
      expect(designTokens.spacing).toEqual({
        'control-compact': 6,
        control: 8,
        section: 16,
        panel: 24,
        page: 32,
        row: 48,
        'row-tight': 44,
      });
    });
  });
});