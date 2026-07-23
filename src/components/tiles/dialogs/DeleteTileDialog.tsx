"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDialogStore } from "@/lib/stores/dialog-store";

interface DeleteTileDialogProps {
  onConfirm: (tileId: string) => void;
}

export function DeleteTileDialog({ onConfirm }: DeleteTileDialogProps) {
  const { t } = useTranslation();
  const { deleteDialog, closeDeleteDialog } = useDialogStore();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const open = deleteDialog.open && deleteDialog.tile !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleConfirm = () => {
    if (!deleteDialog.tile) return;

    onConfirm(deleteDialog.tile.core.id);
    closeDeleteDialog();
  };

  const handleCancel = () => {
    closeDeleteDialog();
  };

  if (!deleteDialog.open || !deleteDialog.tile) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleCancel}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          handleCancel();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          handleCancel();
        }
      }}
      className="w-full max-w-md rounded-xl bg-surface-elevated p-6 backdrop:bg-foreground/50"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {t("tiles.actions.delete")}
        </h2>
        <button
          type="button"
          onClick={handleCancel}
          aria-label={t("common.cancel")}
          className="rounded-full p-1 text-foreground-muted hover:bg-surface-2"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Confirmation message */}
      <div className="mb-6">
        <p className="text-sm text-foreground">{t("tiles.dialogs.deleteConfirm")}</p>
        <p className="mt-2 text-sm font-medium text-foreground">{deleteDialog.tile.core.title}</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-1"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-full bg-danger px-4 py-2 text-sm font-semibold text-background hover:bg-danger"
        >
          {t("common.delete")}
        </button>
      </div>
    </dialog>
  );
}
