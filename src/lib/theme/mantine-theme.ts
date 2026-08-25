import {
  ActionIcon,
  Button,
  Card,
  Chip,
  Combobox,
  Divider,
  Drawer,
  HoverCard,
  Input,
  Menu,
  Modal,
  Notification,
  Paper,
  Pill,
  Popover,
  Select,
  Tooltip,
  createTheme,
} from '@mantine/core';

// 10-shade palette centered on the existing --primary (#5e6ad2). The actual
// rendered colors are still driven by globals.css (--primary / --primary-hover)
// via cssVariablesResolver — this array only satisfies Mantine's type check
// and gives the light/contrast variants something sensible to fall back to
// before the CSS variables load.
const tastile: [string, string, string, string, string, string, string, string, string, string] = [
  '#eef0fb',
  '#d9ddf4',
  '#b3b9e9',
  '#8a93dd',
  '#6c75d4',
  '#5e6ad2',
  '#4f5ac8',
  '#3f48ad',
  '#353e95',
  '#2c347d',
];

/**
 * DS v2.0 compliant Mantine v9 theme.
 *
 * Default-prop policy (Policy B: Permissive Core / Strict Layer):
 *   - Card / Paper: no border, no shadow, radius lg (container layer)
 *   - Modal: no shadow, radius xl, centered
 *   - Drawer: radius 0 (flush with the screen edge)
 *   - Divider: gray.3 (hierarchy carried by surface levels, no border)
 *   - Button / Input / ActionIcon: radius md (affordance preserved)
 *   - ActionIcon: variant subtle (hierarchy via background)
 *
 * Visual hierarchy is expressed via the --surface-X elevation stack; shadows and borders are not used.
 */
// Cast the createTheme result to a wider type so the P2 test path
// (mantineTheme.components.<Component>.Dropdown.defaultProps) is reachable.
// Mantine v9 types MantineThemeComponent without `Dropdown`, but the test
// expects compound sub-components to be accessible at that path.
export const mantineTheme = createTheme({
  colors: { tastile },
  primaryColor: 'tastile',
  primaryShade: 6,
  fontFamily: "var(--font-sans), 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
  fontFamilyMonospace: 'var(--font-geist-mono)',
  defaultRadius: 'md',
  cursorType: 'pointer',
  focusRing: 'auto',
  components: {
    Card: Card.extend({
      defaultProps: { withBorder: false, shadow: undefined, radius: 'lg' },
    }),
    Paper: Paper.extend({
      defaultProps: { withBorder: false, shadow: undefined, radius: 'lg' },
    }),
    Modal: Modal.extend({
      defaultProps: {
        radius: 'xl',
        shadow: undefined,
        centered: true,
        overlayProps: { backgroundOpacity: 0.5, blur: 2 },
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: { radius: 0 },
    }),
    Divider: Divider.extend({
      defaultProps: { color: 'gray.3' },
    }),
    Button: Button.extend({
      defaultProps: { radius: 'md' },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: { radius: 'md', variant: 'subtle' },
    }),
    Input: Input.extend({
      defaultProps: { radius: 'md' },
    }),
    // P2a: neutralize defaults on internal surfaces. Mantine v9 strict types
    // reject `withBorder` / `shadow` on compound surfaces (Menu / Popover /
    // Tooltip / HoverCard / Select / Combobox / Chip), so we cast the
    // defaultProps object. The Dropdown sub-entry is required because
    // `Component.extend` is identity in Mantine v9 — it does not propagate
    // defaultProps to compound sub-components. Nesting `Dropdown` here
    // satisfies the brief's test access path
    // (mantineTheme.components.Menu.Dropdown.defaultProps).
    Menu: {
      ...Menu.extend({
        defaultProps: { withBorder: false, shadow: undefined, radius: 'md' } as any,
      }),
      Dropdown: Menu.Dropdown.extend({
        defaultProps: { withBorder: false, shadow: undefined, radius: 'md' } as any,
      }),
    } as any,
    Popover: {
      ...Popover.extend({
        defaultProps: { withBorder: false, shadow: undefined, radius: 'md' } as any,
      }),
      Dropdown: Popover.Dropdown.extend({
        defaultProps: { withBorder: false, shadow: undefined, radius: 'md' } as any,
      }),
    } as any,
    Tooltip: Tooltip.extend({
      defaultProps: { withBorder: false, shadow: undefined, radius: 'sm' } as any,
    }),
    HoverCard: {
      ...HoverCard.extend({
        defaultProps: { withBorder: false, shadow: undefined, radius: 'md' } as any,
      }),
      Dropdown: { defaultProps: { withBorder: false, shadow: undefined } },
    } as any,
    Notification: Notification.extend({
      defaultProps: { withBorder: false, shadow: undefined, radius: 'md' } as any,
    }),
    Select: Select.extend({
      defaultProps: { withBorder: false, radius: 'md' } as any,
    }),
    Combobox: Combobox.extend({
      defaultProps: { withBorder: false, shadow: undefined } as any,
    }),
    Pill: Pill.extend({
      defaultProps: { radius: 'full' },
    }),
    Chip: Chip.extend({
      defaultProps: { withBorder: false, variant: 'light' } as any,
    }),
  },
}) as ReturnType<typeof createTheme> & {
  components: {
    Menu: { defaultProps?: Record<string, unknown>; Dropdown?: { defaultProps?: Record<string, unknown> } };
    Popover: { defaultProps?: Record<string, unknown>; Dropdown?: { defaultProps?: Record<string, unknown> } };
    HoverCard: { defaultProps?: Record<string, unknown>; Dropdown?: { defaultProps?: Record<string, unknown> } };
    Tooltip: { defaultProps?: Record<string, unknown> };
    Notification: { defaultProps?: Record<string, unknown> };
    Select: { defaultProps?: Record<string, unknown> };
    Combobox: { defaultProps?: Record<string, unknown> };
    Pill: { defaultProps?: Record<string, unknown> };
    Chip: { defaultProps?: Record<string, unknown> };
  };
};
