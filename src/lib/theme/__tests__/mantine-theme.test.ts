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

  describe('P2 Menu defaultProps', () => {
    it('Menu omits withBorder and shadow but preserves radius md', () => {
      expect((mantineTheme.components?.Menu?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.Menu?.defaultProps as AnyProps)?.shadow).toBeUndefined();
      expect((mantineTheme.components?.Menu?.defaultProps as AnyProps)?.radius).toBe('md');
    });
  });

  describe('P2 Popover defaultProps', () => {
    it('Popover omits withBorder and shadow but preserves radius md', () => {
      expect((mantineTheme.components?.Popover?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.Popover?.defaultProps as AnyProps)?.shadow).toBeUndefined();
      expect((mantineTheme.components?.Popover?.defaultProps as AnyProps)?.radius).toBe('md');
    });
  });

  describe('P2 Tooltip defaultProps', () => {
    it('Tooltip omits withBorder and shadow but preserves radius sm', () => {
      expect((mantineTheme.components?.Tooltip?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.Tooltip?.defaultProps as AnyProps)?.shadow).toBeUndefined();
      expect((mantineTheme.components?.Tooltip?.defaultProps as AnyProps)?.radius).toBe('sm');
    });
  });

  describe('P2 HoverCard defaultProps', () => {
    it('HoverCard omits withBorder and shadow but preserves radius md', () => {
      expect((mantineTheme.components?.HoverCard?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.HoverCard?.defaultProps as AnyProps)?.shadow).toBeUndefined();
      expect((mantineTheme.components?.HoverCard?.defaultProps as AnyProps)?.radius).toBe('md');
    });
  });

  describe('P2 Notification defaultProps', () => {
    it('Notification keeps withBorder false and shadow undefined (regression guard)', () => {
      expect((mantineTheme.components?.Notification?.defaultProps as AnyProps)?.withBorder).toBe(false);
      expect((mantineTheme.components?.Notification?.defaultProps as AnyProps)?.shadow).toBeUndefined();
      expect((mantineTheme.components?.Notification?.defaultProps as AnyProps)?.radius).toBe('md');
    });
  });

  describe('P2 Select defaultProps', () => {
    it('Select omits withBorder but preserves radius md', () => {
      expect((mantineTheme.components?.Select?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.Select?.defaultProps as AnyProps)?.radius).toBe('md');
    });
  });

  describe('P2 Combobox defaultProps', () => {
    it('Combobox omits withBorder and shadow', () => {
      expect((mantineTheme.components?.Combobox?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.Combobox?.defaultProps as AnyProps)?.shadow).toBeUndefined();
    });
  });

  describe('P2 Pills defaultProps', () => {
    it('Pill has radius full', () => {
      expect((mantineTheme.components?.Pill?.defaultProps as AnyProps)?.radius).toBe('full');
    });
  });

  describe('P2 Chip defaultProps', () => {
    it('Chip omits withBorder but preserves variant light', () => {
      expect((mantineTheme.components?.Chip?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.Chip?.defaultProps as AnyProps)?.variant).toBe('light');
    });
  });

  describe('P2 Ruling 7 MenuDropdown runtime default', () => {
    it('MenuDropdown omits withBorder and shadow but preserves radius md', () => {
      expect((mantineTheme.components?.MenuDropdown?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.MenuDropdown?.defaultProps as AnyProps)?.shadow).toBeUndefined();
      expect((mantineTheme.components?.MenuDropdown?.defaultProps as AnyProps)?.radius).toBe('md');
    });
  });

  describe('P2 Ruling 7 PopoverDropdown runtime default', () => {
    it('PopoverDropdown omits withBorder and shadow but preserves radius md', () => {
      expect((mantineTheme.components?.PopoverDropdown?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.PopoverDropdown?.defaultProps as AnyProps)?.shadow).toBeUndefined();
      expect((mantineTheme.components?.PopoverDropdown?.defaultProps as AnyProps)?.radius).toBe('md');
    });
  });

  describe('P2 Ruling 7 HoverCardDropdown runtime default', () => {
    it('HoverCardDropdown omits withBorder and shadow', () => {
      expect((mantineTheme.components?.HoverCardDropdown?.defaultProps as AnyProps)?.withBorder).toBeUndefined();
      expect((mantineTheme.components?.HoverCardDropdown?.defaultProps as AnyProps)?.shadow).toBeUndefined();
    });
  });
});
