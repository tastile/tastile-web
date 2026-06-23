"use client";

import { create } from "zustand";

export interface TileEditDraft {
  mode: "create" | "edit";
  /** Existing tile id when mode is "edit". */
  tileId: string | null;
  title: string;
  startAt: string; // ISO datetime-local value (YYYY-MM-DDTHH:mm)
  endAt: string;
  labels: string[];
}

interface TileEditState {
  draft: TileEditDraft | null;
  open: boolean;
  openCreate: (title: string, startAt: string, endAt: string) => void;
  openEdit: (
    tileId: string,
    title: string,
    startAt: string,
    endAt: string,
    labels: string[],
  ) => void;
  close: () => void;
}

const DEFAULT_CREATE_DRAFT: Omit<TileEditDraft, "mode"> = {
  tileId: null,
  title: "",
  startAt: "",
  endAt: "",
  labels: [],
};

export const useTileEditStore = create<TileEditState>()((set) => ({
  draft: null,
  open: false,
  openCreate: (title, startAt, endAt) =>
    set({
      open: true,
      draft: { ...DEFAULT_CREATE_DRAFT, mode: "create", title, startAt, endAt },
    }),
  openEdit: (tileId, title, startAt, endAt, labels) =>
    set({
      open: true,
      draft: { mode: "edit", tileId, title, startAt, endAt, labels },
    }),
  close: () => set({ open: false, draft: null }),
}));
