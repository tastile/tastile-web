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
}
