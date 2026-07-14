type InitialThemeMode = "light" | "dark-gray" | "dark-black";

export function resolveInitialThemeMode(
  storedThemeMode: string | null,
  legacyPersistedStore: string | null,
  prefersDark: boolean,
): InitialThemeMode {
  if (
    storedThemeMode === "light" ||
    storedThemeMode === "dark-gray" ||
    storedThemeMode === "dark-black"
  ) {
    return storedThemeMode;
  }

  if (legacyPersistedStore) {
    try {
      const parsed = JSON.parse(legacyPersistedStore) as {
        state?: { theme?: string };
      };
      if (parsed.state?.theme === "light") return "light";
      if (parsed.state?.theme === "gray") return "dark-gray";
      if (parsed.state?.theme === "dark") return "dark-black";
    } catch {
      // ignore invalid legacy payload
    }
  }

  return prefersDark ? "dark-gray" : "light";
}

// This script runs BEFORE React hydrates to prevent theme flash
export const themeScript = `
(function() {
  try {
    var storedMode = localStorage.getItem('theme-mode');
    var legacyStore = localStorage.getItem('tastile-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var mode = (function(stored, legacy, dark) {
      if (stored === 'light' || stored === 'dark-gray' || stored === 'dark-black') return stored;
      if (legacy) {
        try {
          var parsed = JSON.parse(legacy);
          var legacyTheme = parsed && parsed.state && parsed.state.theme;
          if (legacyTheme === 'light') return 'light';
          if (legacyTheme === 'gray') return 'dark-gray';
          if (legacyTheme === 'dark') return 'dark-black';
        } catch (_e) {}
      }
      return dark ? 'dark-gray' : 'light';
    })(storedMode, legacyStore, prefersDark);

    var root = document.documentElement;
    root.classList.remove('dark', 'theme-dark-gray', 'theme-dark-black', 'theme-light', 'theme-gray', 'theme-dark');
    if (mode === 'dark-gray') root.classList.add('dark', 'theme-dark-gray');
    if (mode === 'dark-black') root.classList.add('dark', 'theme-dark-black');

    // Mirror the resolved mode onto Mantine's color-scheme attribute so its
    // own components follow the same light/dark flip as the custom CSS.
    // Mantine's inline script sets this from prefers-color-scheme before we
    // run; overwriting here keeps both systems in sync on first paint and
    // on every reload.
    var mantineScheme = mode === 'light' ? 'light' : 'dark';
    root.setAttribute('data-mantine-color-scheme', mantineScheme);
    try { localStorage.setItem('mantine-color-scheme-value', mantineScheme); } catch (_e) {}
  } catch (_error) {}
})();
`;
