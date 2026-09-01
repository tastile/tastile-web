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
// (mantineTheme.components.<Component>.Dropdown.defaultProps) is reachable.
// Mantine v9 types MantineThemeComponent without `Dropdown`, but the test
// expects compound sub-components to be accessible at that path.

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
    // P2a: neutralize defaults on internal surfaces. Mantine v9 strict types
    // reject `withBorder` / `shadow` on compound surfaces (Menu / Popover /
    // Tooltip / HoverCard / Select / Combobox / Chip), so we cast the
    // defaultProps object. The Dropdown sub-entry is required to satisfy the
    // brief's test access path
    // (mantineTheme.components.Menu.Dropdown.defaultProps). Mantine v9 reads
    // defaults via theme.components[<static-selector>].defaultProps, so the
    // nested Menu.Dropdown entry is informational only; the runtime default
    // for the dropdown surface is the top-level MenuDropdown entry below
    // (see P2a Ruling 7).
    Menu: {
      defaultProps: {
        withBorder: false,
        shadow: undefined,
        radius: "md",
      } as any,
      Dropdown: {
        defaultProps: {
          withBorder: false,
          shadow: undefined,
          radius: "md",
        } as any,
      },
    } as any,
    Popover: {
      defaultProps: {
        withBorder: false,
        shadow: undefined,
        radius: "md",
      } as any,
      Dropdown: {
        defaultProps: {
          withBorder: false,
          shadow: undefined,
          radius: "md",
        } as any,
      },
    } as any,
    Tooltip: {
      defaultProps: {
        withBorder: false,
        shadow: undefined,
        radius: "sm",
      } as any,
    },
    HoverCard: {
      defaultProps: {
        withBorder: false,
        shadow: undefined,
        radius: "md",
      } as any,
      Dropdown: { defaultProps: { withBorder: false, shadow: undefined } },
    } as any,
    Notification: {
      defaultProps: {
        withBorder: false,
        shadow: undefined,
        radius: "md",
      } as any,
    },
    Select: {
      defaultProps: { withBorder: false, radius: "md" } as any,
    },
    Combobox: {
      defaultProps: { withBorder: false, shadow: undefined } as any,
    },
    Pill: {
      defaultProps: { radius: "full" },
    },
    Chip: {
      defaultProps: { withBorder: false, variant: "light" } as any,
    },
    // P2a Ruling 7: Mantine v9 useProps reads
    // theme.components[<static-selector>].defaultProps (e.g. 'MenuDropdown',
    // 'PopoverDropdown', 'HoverCardDropdown'), not the nested Menu.Dropdown
    // path. The nested entries above satisfy the brief's pin tests but are
    // dead code at runtime; these top-level entries are what Mantine actually
    // consumes when rendering each compound sub-component.
    MenuDropdown: {
      defaultProps: {
        withBorder: false,
        shadow: undefined,
        radius: "md",
      } as any,
    },
    PopoverDropdown: {
      defaultProps: {
        withBorder: false,
        shadow: undefined,
        radius: "md",
      } as any,
    },
    HoverCardDropdown: {
      defaultProps: { withBorder: false, shadow: undefined },
    },
  },
}) as ReturnType<typeof createTheme> & {
  components: {
    Menu: {
      defaultProps?: Record<string, unknown>;
      Dropdown?: { defaultProps?: Record<string, unknown> };
    };
    Popover: {
      defaultProps?: Record<string, unknown>;
      Dropdown?: { defaultProps?: Record<string, unknown> };
    };
    HoverCard: {
      defaultProps?: Record<string, unknown>;
      Dropdown?: { defaultProps?: Record<string, unknown> };
    };
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
