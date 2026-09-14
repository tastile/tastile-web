import { createTheme } from "@mantine/core";

// 10-shade palette centered on the existing --primary (#5e6ad2). The actual
// rendered colors are still driven by globals.css (--primary / --primary-hover)
// via cssVariablesResolver — this array only satisfies Mantine's type check
// and gives the light/contrast variants something sensible to fall back to
// before the CSS variables load.
const tastile: [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
] = [
  "#eef0fb",
  "#d9ddf4",
  "#b3b9e9",
  "#8a93dd",
  "#6c75d4",
  "#5e6ad2",
  "#4f5ac8",
  "#3f48ad",
  "#353e95",
  "#2c347d",
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
// (mantineTheme.components.<Component>.defaultProps) is reachable for the
// static-selectors (MenuDropdown / PopoverDropdown / HoverCardDropdown).
// Mantine v9 types MantineThemeComponent narrowly, but the test path uses
// the wider accessor shape.

// Note: Mantine v9 breakpoints are intentionally left at their em-based
// defaults. The px-based Tailwind system (see globals.css policy block) is
// the project source of truth for any code-level responsive decisions;
// Mantine uses em internally and no project code reads Mantine's breakpoint
// numbers directly.
export const mantineTheme = createTheme({
  colors: { tastile },
  primaryColor: "tastile",
  primaryShade: 6,
  fontFamily:
    "var(--font-sans), 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
  fontFamilyMonospace: "var(--font-geist-mono)",
  defaultRadius: "md",
  cursorType: "pointer",
  focusRing: "auto",
  components: {
    Card: {
      defaultProps: { withBorder: false, shadow: undefined, radius: "lg" },
    },
    Paper: {
      defaultProps: { withBorder: false, shadow: undefined, radius: "lg" },
    },
    Modal: {
      defaultProps: {
        radius: "xl",
        shadow: undefined,
        centered: true,
        overlayProps: { backgroundOpacity: 0.5, blur: 2 },
      },
    },
    Drawer: {
      defaultProps: { radius: 0 },
    },
    Divider: {
      defaultProps: { color: "gray.3" },
    },
    Button: {
      defaultProps: { radius: "md" },
    },
    ActionIcon: {
      defaultProps: { radius: "md", variant: "subtle" },
    },
    Input: {
      defaultProps: { radius: "md" },
    },
    // P2a: neutralize defaults on internal surfaces. Mantine v9.6 does not
    // destructure `withBorder` or `shadow` on compound surfaces (Menu /
    // Popover / Tooltip / HoverCard / Select / Combobox / Chip), so passing
    // them via defaultProps leaks the props through ...others onto the inner
    // Box and onto the DOM element rendered by targetProps, producing the
    // "React does not recognize the withBorder prop" warning. We therefore
    // omit those keys here and rely on `--mantine-default-border: transparent`
    // (see src/lib/theme/css-variables-resolver.ts) for the neutral border.
    // Only `radius` is preserved on these compound surfaces.
    Menu: {
      defaultProps: {
        radius: "md",
      } as any,
    } as any,
    Popover: {
      defaultProps: {
        radius: "md",
      } as any,
    } as any,
    Tooltip: {
      defaultProps: {
        radius: "sm",
      } as any,
    },
    HoverCard: {
      defaultProps: {
        radius: "md",
      } as any,
    } as any,
    Notification: {
      defaultProps: {
        withBorder: false,
        shadow: undefined,
        radius: "md",
      } as any,
    },
    Select: {
      defaultProps: { radius: "md" } as any,
    },
    Combobox: {
      defaultProps: {} as any,
    },
    Pill: {
      defaultProps: { radius: "full" },
    },
    Chip: {
      defaultProps: { variant: "light" } as any,
    },
    // P2a Ruling 7: Mantine v9 useProps reads
    // theme.components[<static-selector>].defaultProps (e.g. 'MenuDropdown',
    // 'PopoverDropdown', 'HoverCardDropdown'). These top-level entries are
    // what Mantine actually consumes when rendering each compound
    // sub-component. `withBorder` / `shadow` are intentionally omitted for
    // the same reason as the parent compound entries above.
    MenuDropdown: {
      defaultProps: {
        radius: "md",
      } as any,
    },
    PopoverDropdown: {
      defaultProps: {
        radius: "md",
      } as any,
    },
    HoverCardDropdown: {
      defaultProps: {},
    },
  },
}) as ReturnType<typeof createTheme> & {
  components: {
    Menu: { defaultProps?: Record<string, unknown> };
    Popover: { defaultProps?: Record<string, unknown> };
    HoverCard: { defaultProps?: Record<string, unknown> };
    Tooltip: { defaultProps?: Record<string, unknown> };
    Notification: { defaultProps?: Record<string, unknown> };
    Select: { defaultProps?: Record<string, unknown> };
    Combobox: { defaultProps?: Record<string, unknown> };
    Pill: { defaultProps?: Record<string, unknown> };
    Chip: { defaultProps?: Record<string, unknown> };
    MenuDropdown: { defaultProps?: Record<string, unknown> };
    PopoverDropdown: { defaultProps?: Record<string, unknown> };
    HoverCardDropdown: { defaultProps?: Record<string, unknown> };
  };
};
