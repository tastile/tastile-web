"use client";

import {
  ActionIcon,
  Box,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  Text,
  ThemeIcon,
  Transition,
} from "@mantine/core";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import classes from "./QuickTileCreateShell.module.css";

export type QuickCreatePanelId =
  | "base"
  | "intent"
  | "time"
  | "duration"
  | "recurring"
  | "references"
  | "completion"
  | "meta"
  | "behavior";

type QuickCreateDrawerProps = {
  opened: boolean;
  isDesktop: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
};

export function QuickCreateDrawer({
  opened,
  isDesktop,
  onClose,
  header,
  children,
}: QuickCreateDrawerProps) {
  return (
    <Drawer.Root
      opened={opened}
      onClose={onClose}
      position={isDesktop ? "right" : "bottom"}
      size={isDesktop ? "36rem" : "85dvh"}
      zIndex={55}
      transitionProps={{ duration: 220, timingFunction: "ease-out" }}
      removeScrollProps={{ allowPinchZoom: true }}
    >
      <Drawer.Overlay data-testid="quick-create-backdrop" backgroundOpacity={0.1} blur={1} />
      <Drawer.Content
        className={classes.drawerContent}
        data-desktop={isDesktop ? "true" : undefined}
      >
        {header}
        <Drawer.Body className={classes.drawerBody}>
          <Box className={classes.mainFrame} data-desktop={isDesktop ? "true" : undefined}>
            {children}
          </Box>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}

type QuickCreateHeaderProps = {
  title: string;
  closeLabel: string;
  icon: LucideIcon;
};

export function QuickCreateHeader({ title, closeLabel, icon: Icon }: QuickCreateHeaderProps) {
  return (
    <Drawer.Header className={classes.header}>
      <Group gap="sm" wrap="nowrap" className={classes.headerMain}>
        <ThemeIcon variant="light" radius="md" size="lg" aria-hidden>
          <Icon size={16} />
        </ThemeIcon>
        <Drawer.Title className={classes.title}>{title}</Drawer.Title>
      </Group>
      <Drawer.CloseButton aria-label={closeLabel} />
    </Drawer.Header>
  );
}

export function QuickCreateContent({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className={classes.content} type="auto" offsetScrollbars>
      <Box className={classes.contentInner}>{children}</Box>
    </ScrollArea>
  );
}

export function QuickCreateFooter({ children }: { children: ReactNode }) {
  return <Box className={classes.footer}>{children}</Box>;
}

type QuickCreateChoiceCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function QuickCreateChoiceCard({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
}: QuickCreateChoiceCardProps) {
  return (
    <Paper
      component="button"
      type="button"
      withBorder
      radius="md"
      p="sm"
      onClick={onClick}
      disabled={disabled}
      className={classes.choiceCard}
    >
      <ThemeIcon variant="light" size="sm" radius="md" aria-hidden>
        <Icon size={16} />
      </ThemeIcon>
      <Text fw={600} size="xs" mt={6}>
        {title}
      </Text>
      <Text size="xs" c="dimmed" mt={2} lh={1.35}>
        {description}
      </Text>
    </Paper>
  );
}

type QuickCreateSubPanelProps = {
  id: Exclude<QuickCreatePanelId, "base">;
  opened: boolean;
  isDesktop: boolean;
  title: string;
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
};

export function QuickCreateSubPanel({
  id,
  opened,
  isDesktop,
  title,
  subtitle,
  backLabel,
  onBack,
  children,
}: QuickCreateSubPanelProps) {
  return (
    <Transition
      mounted={opened}
      transition={isDesktop ? "slide-left" : "slide-up"}
      duration={220}
      timingFunction="ease-out"
    >
      {(transitionStyle) => (
        <Paper
          component="section"
          role="dialog"
          aria-label={title}
          data-subpanel={id}
          data-desktop={isDesktop ? "true" : undefined}
          className={classes.subPanel}
          style={transitionStyle}
          radius={isDesktop ? 0 : "lg"}
          shadow="lg"
        >
          <Group className={classes.subPanelHeader} gap="sm" wrap="nowrap">
            <ActionIcon
              type="button"
              variant="subtle"
              size="lg"
              radius="md"
              onClick={onBack}
              aria-label={backLabel}
            >
              <ChevronLeft size={16} aria-hidden />
            </ActionIcon>
            <Box className={classes.subPanelHeading}>
              <Text fw={600} size="sm" truncate>
                {title}
              </Text>
              {subtitle ? (
                <Text size="xs" c="dimmed" truncate>
                  {subtitle}
                </Text>
              ) : null}
            </Box>
          </Group>
          <Box className={classes.subPanelBody}>{children}</Box>
        </Paper>
      )}
    </Transition>
  );
}
