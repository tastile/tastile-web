"use client";

import { DateInput, TimeInput } from "@mantine/dates";
import { Check, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDialogStore } from "@/lib/stores/dialog-store";
import {
  getCurrentLocalDate,
  getCurrentLocalTime,
  parseDateTimeParts,
} from "@/lib/utils/tile-formatters";

interface DeferTileDialogProps {
  onConfirm: (tileId: string, nextStartAt: Date) => void;
}

export function DeferTileDialog({ onConfirm }: DeferTileDialogProps) {
  const { t } = useTranslation();
  const { deferDialog, closeDeferDialog } = useDialogStore();
  const [datePart, setDatePart] = useState("");
  const [timePart, setTimePart] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const open = deferDialog.open && deferDialog.tile !== null;
  const title =
    deferDialog.mode === "defer"
      ? t("tiles.dialogs.deferTitle")
      : t("tiles.dialogs.interruptTitle");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const resolvedDatePart = datePart || getCurrentLocalDate();
  const resolvedTimePart = timePart || getCurrentLocalTime();

  const handleConfirm = () => {
    if (!deferDialog.tile) return;

    const nextStartAt = parseDateTimeParts(resolvedDatePart, resolvedTimePart);
    if (!nextStartAt) {
      alert("Invalid date/time");
      return;
    }

    onConfirm(deferDialog.tile.core.id, nextStartAt);
    closeDeferDialog();
  };

  const handleCancel = () => {
    setDatePart("");
    setTimePart("");
    closeDeferDialog();
  };

  if (!deferDialog.open || !deferDialog.tile) return null;

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
          {title}
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

      {/* Tile info */}
      <div className="mb-4">
        <p className="text-sm text-foreground">{deferDialog.tile.core.title}</p>
        {deferDialog.tile.core.nextAction && (
          <p className="mt-1 text-xs text-foreground-muted">{deferDialog.tile.core.nextAction}</p>
        )}
      </div>

      {/* Date/Time inputs */}
      <div className="mb-6 space-y-3">
        <div>
          <label className="mb-1 block text-xs text-foreground-muted" htmlFor="defer-date">
            {t("tiles.dialogs.nextStartAt")}
          </label>
          <div className="flex gap-2">
            <DateInput
              id="defer-date"
              value={resolvedDatePart ? new Date(resolvedDatePart) : null}
              onChange={(value) => {
                if (!value) {
                  setDatePart("");
                  return;
                }
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) {
                  setDatePart(value);
                  return;
                }
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const d = String(date.getDate()).padStart(2, "0");
                setDatePart(`${y}-${m}-${d}`);
              }}
              size="sm"
              valueFormat="YYYY-MM-DD"
              popoverProps={{ withinPortal: true }}
              styles={{ input: { backgroundColor: "var(--surface-1)" } }}
              className="flex-1"
            />
            <TimeInput
              id="defer-time"
              value={resolvedTimePart}
              onChange={(event) => setTimePart(event.currentTarget.value)}
              size="sm"
              styles={{ input: { backgroundColor: "var(--surface-1)" } }}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          iconLeft={<X size={14} aria-hidden="true" />}
          onClick={handleCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          variant="primary"
          iconLeft={<Check size={14} aria-hidden="true" />}
          onClick={handleConfirm}
        >
          {t("common.confirm")}
        </Button>
      </div>
    </dialog>
  );
}
