import { create } from "zustand";
import type { Tile } from "../domain/tile";

interface DialogState {
  deferDialog: {
    open: boolean;
    tile: Tile | null;
    mode: "defer" | "interrupt";
  };
  deleteDialog: {
    open: boolean;
    tile: Tile | null;
  };
  openDeferDialog: (tile: Tile, mode: "defer" | "interrupt") => void;
  closeDeferDialog: () => void;
  openDeleteDialog: (tile: Tile) => void;
  closeDeleteDialog: () => void;
  recurringDialog: {
    open: boolean;
    tileId: string | null;
  };
  openRecurringDialog: (tileId: string) => void;
  closeRecurringDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  deferDialog: {
    open: false,
    tile: null,
    mode: "defer",
  },
  deleteDialog: {
    open: false,
    tile: null,
  },
  openDeferDialog: (tile, mode) =>
    set({
      deferDialog: {
        open: true,
        tile,
        mode,
      },
    }),
  closeDeferDialog: () =>
    set({
      deferDialog: {
        open: false,
        tile: null,
        mode: "defer",
      },
    }),
  openDeleteDialog: (tile) =>
    set({
      deleteDialog: {
        open: true,
        tile,
      },
    }),
  closeDeleteDialog: () =>
    set({
      deleteDialog: {
        open: false,
        tile: null,
      },
    }),
  recurringDialog: {
    open: false,
    tileId: null,
  },
  openRecurringDialog: (tileId: string) =>
    set({
      recurringDialog: { open: true, tileId },
    }),
  closeRecurringDialog: () =>
    set({
      recurringDialog: { open: false, tileId: null },
    }),
}));
