"use client";

import { Modal, Stack, Title } from "@mantine/core";
import type * as React from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <Modal opened={open} onClose={() => onOpenChange(false)} withCloseButton={false} centered>
      {children}
    </Modal>
  );
}

Dialog.displayName = "Dialog";

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: "tiny" | "small" | "medium" | "large" | "xlarge" | "xxlarge" | "drawer";
}

const SIZE_MAP: Record<NonNullable<DialogContentProps["size"]>, string> = {
  tiny: "xs",
  small: "sm",
  medium: "md",
  large: "lg",
  xlarge: "xl",
  xxlarge: "100rem",
  drawer: "lg",
};

const DialogContent = ({ className, children, size = "medium", ...props }: DialogContentProps) => {
  // Mantine's <Modal> is the overlay+content shell, so DialogContent is a
  // passthrough layout wrapper inside it. Stays for API parity with the
  // previous Radix-free implementation.
  return (
    <div className={className} {...props}>
      <Stack gap="md">{children}</Stack>
    </div>
  );
};

DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={className} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={className} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Title order={2} className={className} {...props}>
    {children}
  </Title>
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={className} {...props} />
);
DialogDescription.displayName = "DialogDescription";

// Re-exported for parity. DialogOverlay is provided by Mantine internally and
// is no longer a separately-rendered component in this tree.
const DialogOverlay = () => null;
DialogOverlay.displayName = "DialogOverlay";

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  SIZE_MAP,
};
