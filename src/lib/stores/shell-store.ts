"use client";

import { create } from "zustand";

export type SidePanel = "references" | "tasks" | "projects" | "schedule";

interface ShellState {
  panel: SidePanel;
  sideBarOpen: boolean;
  setPanel: (p: SidePanel) => void;
  toggleSideBar: () => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  panel: "references",
  sideBarOpen: true,
  setPanel: (panel) => set({ panel, sideBarOpen: true }),
  toggleSideBar: () => set((s) => ({ sideBarOpen: !s.sideBarOpen })),
}));
