import {
  ActionIcon,
  Button,
  Card,
  Divider,
  Drawer,
  Input,
  Modal,
  Paper,
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
  },
});
