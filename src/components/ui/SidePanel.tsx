"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

interface SidePanelProps extends VariantProps<typeof sidePanelVariants> {
  visible: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hideFooter?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const sidePanelVariants = cva(
  [
    "fixed inset-y-0 z-50 flex flex-col bg-surface-1 shadow-xl",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "transition-all duration-200",
  ].join(" "),
  {
    variants: {
      size: {
        small: "w-80",
        medium: "w-96",
        large: "w-[32rem]",
        xlarge: "w-[40rem]",
      },
      align: {
        right: "inset-y-0 right-0",
        left: "inset-y-0 left-0",
      },
    },
    defaultVariants: {
      size: "medium",
      align: "right",
    },
  },
);

const SidePanel = ({
  visible,
  onCancel,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  header,
  children,
  footer,
  hideFooter = false,
  loading = false,
  disabled = false,
  size = "medium",
  align = "right",
  className,
}: SidePanelProps) => {
  return (
    <DialogPrimitive.Root open={visible} onOpenChange={(open) => !open && onCancel?.()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(sidePanelVariants({ size, align }), className)}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            onCancel?.();
          }}
        >
          {header && (
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="min-w-0 flex-1">{header}</div>
              <DialogPrimitive.Close className="ml-4 rounded-xs p-1 opacity-20 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                <X size={16} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {!hideFooter && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              {footer ?? (
                <>
                  <Button variant="default" onClick={onCancel} disabled={loading}>
                    {cancelText}
                  </Button>
                  {onConfirm && (
                    <Button
                      variant="primary"
                      onClick={onConfirm}
                      disabled={disabled || loading}
                      loading={loading}
                    >
                      {confirmText}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

SidePanel.displayName = "SidePanel";

export type { SidePanelProps };
export { SidePanel, sidePanelVariants };
