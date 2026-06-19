"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  enabled: string[];
  toggle: (label: string) => void;
  enable: (label: string) => void;
  disable: (label: string) => void;
}

export const useReferenceOverlayStore = create<State>()(
  persist(
    (set, get) => ({
      enabled: [],
      toggle: (label) => {
        const e = new Set(get().enabled);
        if (e.has(label)) e.delete(label);
        else e.add(label);
        set({ enabled: Array.from(e) });
      },
      enable: (label) => set((s) => ({ enabled: Array.from(new Set([...s.enabled, label])) })),
      disable: (label) => set((s) => ({ enabled: s.enabled.filter((l) => l !== label) })),
    }),
    { name: "tastile.reference-overlay" },
  ),
);
