import { describe, expect, it } from 'vitest';
import { mantineTheme } from '../mantine-theme';

type AnyProps = Record<string, unknown>;

describe('mantineTheme', () => {
  it('primaryColor is tastile', () => {
    expect(mantineTheme.primaryColor).toBe('tastile');
  });

  it('defaultRadius is md', () => {
    expect(mantineTheme.defaultRadius).toBe('md');
  });

  describe('Card defaultProps', () => {
    it('withBorder is false', () => {
      expect((mantineTheme.components?.Card?.defaultProps as AnyProps)?.withBorder).toBe(false);
    });

    it('shadow is undefined', () => {
      expect((mantineTheme.components?.Card?.defaultProps as AnyProps)?.shadow).toBeUndefined();
    });

    it('radius is lg', () => {
      expect((mantineTheme.components?.Card?.defaultProps as AnyProps)?.radius).toBe('lg');
    });
  });

  describe('Paper defaultProps', () => {
    it('withBorder is false', () => {
      expect((mantineTheme.components?.Paper?.defaultProps as AnyProps)?.withBorder).toBe(false);
    });

    it('shadow is undefined', () => {
      expect((mantineTheme.components?.Paper?.defaultProps as AnyProps)?.shadow).toBeUndefined();
    });

    it('radius is lg', () => {
      expect((mantineTheme.components?.Paper?.defaultProps as AnyProps)?.radius).toBe('lg');
    });
  });

  describe('Modal defaultProps', () => {
    it('radius is xl', () => {
      expect((mantineTheme.components?.Modal?.defaultProps as AnyProps)?.radius).toBe('xl');
    });

    it('shadow is undefined', () => {
      expect((mantineTheme.components?.Modal?.defaultProps as AnyProps)?.shadow).toBeUndefined();
    });

    it('centered is true', () => {
      expect((mantineTheme.components?.Modal?.defaultProps as AnyProps)?.centered).toBe(true);
    });
  });

  describe('Drawer defaultProps', () => {
    it('radius is 0', () => {
      expect((mantineTheme.components?.Drawer?.defaultProps as AnyProps)?.radius).toBe(0);
    });
  });

  describe('Divider defaultProps', () => {
    it('color is gray.3', () => {
      expect((mantineTheme.components?.Divider?.defaultProps as AnyProps)?.color).toBe('gray.3');
    });
  });

  describe('Button defaultProps', () => {
    it('radius is md', () => {
      expect((mantineTheme.components?.Button?.defaultProps as AnyProps)?.radius).toBe('md');
    });
  });

  describe('ActionIcon defaultProps', () => {
    it('radius is md', () => {
      expect((mantineTheme.components?.ActionIcon?.defaultProps as AnyProps)?.radius).toBe('md');
    });

    it('variant is subtle', () => {
      expect((mantineTheme.components?.ActionIcon?.defaultProps as AnyProps)?.variant).toBe('subtle');
    });
  });

  describe('Input defaultProps', () => {
    it('radius is md', () => {
      expect((mantineTheme.components?.Input?.defaultProps as AnyProps)?.radius).toBe('md');
    });
  });
});
