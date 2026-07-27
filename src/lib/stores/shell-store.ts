"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidePanel = "references" | "tasks" | "projects" | "schedule";

/** Equivalent to the three Supabase modes */
export type SidebarBehavior = "expandable" | "open" | "closed";

interface ShellState {
  panel: SidePanel;
  sideBarOpen: boolean;
  /** Sidebar behavior mode (persisted to localStorage) */
  sidebarBehavior: SidebarBehavior;
  setPanel: (p: SidePanel) => void;
  toggleSideBar: () => void;
  setSidebarBehavior: (b: SidebarBehavior) => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      panel: "references",
      sideBarOpen: true,
      sidebarBehavior: "expandable",
      setPanel: (panel) => set({ panel, sideBarOpen: true }),
      toggleSideBar: () => set((s) => ({ sideBarOpen: !s.sideBarOpen })),
      setSidebarBehavior: (sidebarBehavior) => set({ sidebarBehavior }),
    }),
    {
      name: "tastile-shell-store",
      partialize: (s) => ({ sidebarBehavior: s.sidebarBehavior }),
    },
  ),
);
