"use client";

import { Drawer } from "@mantine/core";
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
    <Drawer
      opened={open}
      onClose={() => onOpenChange(false)}
      position="bottom"
      size="80vh"
      withCloseButton={!hideClose}
      title={title}
      transitionProps={{ transition: "slide-up", duration: 240 }}
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
      classNames={{ content: cn("rounded-t-2xl", className) }}
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
