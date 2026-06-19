"use client";

import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDialogStore } from "@/lib/stores/dialog-store";

interface DeleteTileDialogProps {
  onConfirm: (tileId: string) => void;
}

export function DeleteTileDialog({ onConfirm }: DeleteTileDialogProps) {
  const { t } = useTranslation();
  const { deleteDialog, closeDeleteDialog } = useDialogStore();

  if (!deleteDialog.open || !deleteDialog.tile) return null;

  const handleConfirm = () => {
    if (!deleteDialog.tile) return;

    onConfirm(deleteDialog.tile.core.id);
    closeDeleteDialog();
  };

  const handleCancel = () => {
    closeDeleteDialog();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop closes dialog on click
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click closes via mouse only; ESC handled at dialog level
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50"
      onClick={handleCancel}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dialog body intercepts backdrop clicks */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation is intentional to keep dialog open */}
      <div
        className="w-full max-w-md rounded-xl bg-surface-elevated p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("tiles.actions.delete")}</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full p-1 text-foreground-muted hover:bg-surface-2"
          >
            <X className="h-5 w-5" />
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
      </div>
    </div>
  );
}
