export type ThemeMode = "light" | "dark-gray" | "dark-black";

export const THEME_MODE_STORAGE_KEY = "theme-mode";

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.remove(
    "dark",
    "theme-dark-gray",
    "theme-dark-black",
    "theme-light",
    "theme-gray",
    "theme-dark",
  );

  if (mode === "dark-gray") {
    root.classList.add("dark", "theme-dark-gray");
  }

  if (mode === "dark-black") {
    root.classList.add("dark", "theme-dark-black");
  }

  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);

  // Mantine reads `data-mantine-color-scheme` on <html> to pick light/dark
  // variables for its own components (TextInput, Select, Switch, Modal, ...).
  // Our custom theme only toggles classes above, so without this sync Mantine
  // stays on whatever `ColorSchemeScript` last set (often the OS preference),
  // leaving dark Mantine controls on a light page after the user toggles.
  const mantineScheme = mode === "light" ? "light" : "dark";
  root.setAttribute("data-mantine-color-scheme", mantineScheme);
  window.localStorage.setItem("mantine-color-scheme-value", mantineScheme);
}
