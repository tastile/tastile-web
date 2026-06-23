"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils/cn";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  hideClose?: boolean;
}

export function BottomSheet({
  open,
  onOpenChange,
  children,
  title,
  className,
  hideClose = false,
}: BottomSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* 背景の遮蔽 */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 transition-opacity duration-200" />

        {/* ボトムシートのコンテンツ本体 */}
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col rounded-t-2xl bg-surface-1 border-t border-border shadow-xl",
            "focus:outline-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "transition-all duration-300 ease-out",
            className,
          )}
        >
          {/* ボトムシート上部のドラッグインジケータ */}
          <div className="flex justify-center py-3 shrink-0">
            <div className="h-1.5 w-12 rounded-full bg-border" />
          </div>

          {(title || !hideClose) && (
            <div className="flex items-center justify-between border-b border-border px-6 pb-4 shrink-0">
              {title ? (
                <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                  {title}
                </DialogPrimitive.Title>
              ) : (
                <div />
              )}
              {!hideClose && (
                <DialogPrimitive.Close className="rounded-sm p-1 opacity-60 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                  <X size={18} />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
            </div>
          )}

          {/* メインコンテンツスクロールエリア */}
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
