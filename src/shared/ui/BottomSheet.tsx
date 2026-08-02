"use client";

import { cn } from "@/shared/lib/cn";
import { PANEL_ANIM_ATTR } from "@/shared/ui/panel-styles";
import { Drawer } from "@mantine/core";
import type * as React from "react";

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
    <Drawer
      opened={open}
      onClose={() => onOpenChange(false)}
      position="bottom"
      size="80vh"
      withCloseButton={!hideClose}
      title={title ? <h2 id="bottom-sheet-title">{title}</h2> : undefined}
      aria-labelledby={title ? "bottom-sheet-title" : undefined}
      transitionProps={{ transition: "slide-up", duration: 240 }}
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
      classNames={{ content: cn("rounded-t-2xl", className) }}
      {...{ [PANEL_ANIM_ATTR]: "" }}
      withOverlay
      lockScroll
      trapFocus
      closeOnEscape
      closeOnClickOutside
    >
      {children}
    </Drawer>
  );
}
