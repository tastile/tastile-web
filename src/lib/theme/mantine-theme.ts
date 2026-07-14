import { createTheme } from "@mantine/core";

// 10-shade palette centered on the existing --primary (#5e6ad2). The actual
// rendered colors are still driven by globals.css (--primary / --primary-hover)
// via cssVariablesResolver — this array only satisfies Mantine's type check
// and gives the light/contrast variants something sensible to fall back to
// before the CSS variables load.
const tastile: [string, string, string, string, string, string, string, string, string, string] = [
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

export const mantineTheme = createTheme({
  colors: { tastile },
  primaryColor: "tastile",
  primaryShade: 6,
  fontFamily: "var(--font-inter), 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
  fontFamilyMonospace: "var(--font-geist-mono)",
  defaultRadius: "md",
  cursorType: "pointer",
  focusRing: "auto",
});
