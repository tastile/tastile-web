"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type SidePanel = "references" | "tasks" | "projects" | "schedule";

/** Equivalent to the three Supabase modes */
export type SidebarBehavior = "expandable" | "open" | "closed";

interface ShellState {
  panel: SidePanel;
  sideBarOpen: boolean;
  /** Side detail panel open/closed (persisted to localStorage) */
  sidePanelOpen: boolean;
  /** Sidebar behavior mode (persisted to localStorage) */
  sidebarBehavior: SidebarBehavior;
  setPanel: (p: SidePanel) => void;
  toggleSideBar: () => void;
  toggleSidePanel: () => void;
  setSidePanel: (open: boolean) => void;
  setSidebarBehavior: (b: SidebarBehavior) => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      panel: "references",
      sideBarOpen: true,
      sidePanelOpen: true,
      sidebarBehavior: "expandable",
      setPanel: (panel) => set({ panel, sideBarOpen: true }),
      toggleSideBar: () => set((s) => ({ sideBarOpen: !s.sideBarOpen })),
      toggleSidePanel: () => set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),
      setSidePanel: (sidePanelOpen) => set({ sidePanelOpen }),
      setSidebarBehavior: (sidebarBehavior) => set({ sidebarBehavior }),
    }),
    {
      name: "tastile-shell-store",
      partialize: (s) => ({ sidebarBehavior: s.sidebarBehavior, sidePanelOpen: s.sidePanelOpen }),
    },
  ),
);
