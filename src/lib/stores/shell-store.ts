"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidePanel = "references" | "tasks" | "projects" | "schedule";

/** Supabase と同等の3モード */
export type SidebarBehavior = "expandable" | "open" | "closed";

interface ShellState {
  panel: SidePanel;
  sideBarOpen: boolean;
  /** サイドバーの挙動モード（localStorage に永続化） */
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
