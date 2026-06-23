"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#06b6d4",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#84cc16",
  "#6b7280",
];

interface LabelEntry {
  name: string;
  color: string;
}

interface LabelsState {
  labels: Record<string, LabelEntry>;
  ensureLabel: (name: string) => void;
  setColor: (name: string, color: string) => void;
  remove: (name: string) => void;
}

export const useLabelsStore = create<LabelsState>()(
  persist(
    (set, get) => ({
      labels: {},
      ensureLabel: (name) => {
        if (get().labels[name]) return;
        const used = new Set(Object.values(get().labels).map((l) => l.color));
        const next = PALETTE.find((c) => !used.has(c)) ?? PALETTE[0];
        set((s) => ({ labels: { ...s.labels, [name]: { name, color: next } } }));
      },
      setColor: (name, color) => set((s) => ({ labels: { ...s.labels, [name]: { name, color } } })),
      remove: (name) =>
        set((s) => {
          const rest = { ...s.labels };
          delete (rest as Record<string, LabelEntry>)[name];
          return { labels: rest };
        }),
    }),
    { name: "tastile.labels" },
  ),
);
