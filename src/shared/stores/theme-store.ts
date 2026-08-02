import { applyThemeMode } from "@/lib/theme-mode";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "gray" | "dark";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    {
      name: "tastile-theme",
      onRehydrateStorage: () => (state) => {
        // Only apply the rehydrated theme when storage actually held a value.
        // On first visit localStorage is empty, so Zustand falls back to the
        // default `{ theme: "light" }` and passes that here. Calling
        // `applyTheme` in that case would clobber the system-preference theme
        // already applied by the inline theme-script (e.g. a dark-mode user
        // would suddenly see the light theme the moment the store hydrates).
        if (state && state.theme !== "light") {
          applyTheme(state.theme);
        }
      },
    },
  ),
);

function applyTheme(theme: Theme) {
  const mode = theme === "light" ? "light" : theme === "gray" ? "dark-gray" : "dark-black";
  applyThemeMode(mode);
}
