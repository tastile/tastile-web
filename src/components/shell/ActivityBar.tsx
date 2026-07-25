"use client";

import { Button, Divider, Menu, Tooltip } from "@mantine/core";
import {
  CalendarDays,
  CheckSquare,
  Layers,
  type LucideIcon,
  PanelLeftDashed,
  Plus,
  Repeat,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { type SidebarBehavior, useShellStore } from "@/lib/stores/shell-store";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  path: string;
  labelKey: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard/timeline", labelKey: "nav.timeline", Icon: CalendarDays },
  { path: "/dashboard/tasks", labelKey: "nav.tasks", Icon: CheckSquare },
  { path: "/dashboard/projects", labelKey: "nav.projects", Icon: Layers },
  { path: "/dashboard/schedule", labelKey: "nav.schedule", Icon: Repeat },
];

const PREF_ITEM: NavItem = {
  path: "/dashboard/preferences",
  labelKey: "nav.preferences",
  Icon: Settings,
};

const SIDEBAR_BEHAVIORS: {
  value: SidebarBehavior;
  labelKey: string;
}[] = [
    { value: "open", labelKey: "shell.activityBar.expanded" },
    { value: "closed", labelKey: "shell.activityBar.collapsed" },
    { value: "expandable", labelKey: "shell.activityBar.expandOnHover" },
  ];

export function ActivityBar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const sidebarBehavior = useShellStore((s) => s.sidebarBehavior);
  const setSidebarBehavior = useShellStore((s) => s.setSidebarBehavior);
  const [hovered, setHovered] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);

  const expanded = sidebarBehavior === "open" || (sidebarBehavior === "expandable" && hovered);

  const openQuickCreate = () => {
    useQuickCreateStore.getState().openCreate({ initialAllDay: false });
  };

  return (
    <div
      className={cn(
        "relative z-20 hidden shrink-0 transition-[width] duration-200 ease-in-out md:block",
        sidebarBehavior === "open" ? "w-48" : "w-12",
      )}
    >
      <nav
        aria-label={t("shell.activityBar.ariaLabel")}
        className={cn(
          "absolute inset-y-0 left-0 flex flex-col items-stretch overflow-hidden bg-surface-0",
          "transition-[width] duration-200 ease-in-out",
          expanded ? "w-48" : "w-12",
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="px-1 pt-1">
          <ActivityButton
            label={t("nav.new")}
            Icon={Plus}
            expanded={expanded}
            onClick={openQuickCreate}
            data-testid="sidebar-new-tile"
            withTooltip
          />
        </div>

        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden px-1 pt-2">
          {NAV_ITEMS.map(({ path, labelKey, Icon }) => (
            <ActivityLink
              key={path}
              href={path}
              label={t(labelKey)}
              Icon={Icon}
              active={pathname === path || pathname.startsWith(`${path}/`)}
              expanded={expanded}
            />
          ))}

          <Divider className="mx-2 my-2 shrink-0 border-border" />

          <ActivityLink
            href={PREF_ITEM.path}
            label={t(PREF_ITEM.labelKey)}
            Icon={PREF_ITEM.Icon}
            active={pathname.startsWith("/dashboard/preferences")}
            expanded={expanded}
          />
        </div>

        <div className="px-1 pb-1">
          <Menu
            opened={menuOpened}
            onChange={setMenuOpened}
            position="top-start"
            offset={4}
            width={176}
            shadow="lg"
            closeOnItemClick
          >
            <Menu.Target>
              <ActivityButton
                label={t("shell.activityBar.sidebar")}
                ariaLabel={t("shell.activityBar.sidebarControl")}
                Icon={PanelLeftDashed}
                expanded={expanded}
              />
            </Menu.Target>

            <Menu.Dropdown className="border-border bg-surface-elevated">
              <Menu.Label>{t("shell.activityBar.sidebarControl")}</Menu.Label>
              <Menu.Divider />
              <Menu.RadioGroup
                value={sidebarBehavior}
                onChange={(value) => setSidebarBehavior(value as SidebarBehavior)}
              >
                {SIDEBAR_BEHAVIORS.map(({ value, labelKey }) => (
                  <Menu.RadioItem key={value} value={value}>
                    {t(labelKey)}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Dropdown>
          </Menu>
        </div>
      </nav>
    </div>
  );
}

interface ActivityButtonProps extends ComponentPropsWithoutRef<"button"> {
  label: string;
  Icon: LucideIcon;
  expanded: boolean;
  ariaLabel?: string;
  withTooltip?: boolean;
}

const activityButtonStyles = {
  root: {
    width: "100%",
    height: 40,
    minHeight: 40,
    padding: 0,
    overflow: "hidden",
    flexShrink: 0,
  },
  inner: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-start",
  },
  label: {
    display: "block",
    width: "100%",
    height: "100%",
    overflow: "visible",
  },
} as const;

interface ActivityContentProps {
  label: string;
  Icon: LucideIcon;
  expanded: boolean;
  active?: boolean;
}

function ActivityContent({ label, Icon, expanded, active = false }: ActivityContentProps) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: 40,
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          minWidth: 40,
          height: 40,
          flex: "0 0 40px",
        }}
      >
        <Icon className={cn("h-4 w-4", active && "text-foreground")} aria-hidden />
      </span>
      <span
        className={cn(
          "min-w-0 whitespace-nowrap text-left text-sm",
          "transition-[opacity,transform] duration-200 ease-in-out",
          expanded
            ? "translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-2 opacity-0",
        )}
        style={{
          display: "block",
          flex: "1 1 auto",
          overflow: "hidden",
        }}
      >
        {label}
      </span>
    </span>
  );
}

const ActivityButton = forwardRef<HTMLButtonElement, ActivityButtonProps>(
  function ActivityButton(
    { label, Icon, expanded, ariaLabel, withTooltip = false, className, ...props },
    ref,
  ) {
    const button = (
      <Button
        ref={ref}
        type="button"
        variant="subtle"
        aria-label={ariaLabel ?? label}
        className={cn(
          "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
          className,
        )}
        styles={activityButtonStyles}
        {...props}
      >
        <ActivityContent label={label} Icon={Icon} expanded={expanded} />
      </Button>
    );

    if (!withTooltip) return button;

    return (
      <Tooltip label={label} position="right" withArrow openDelay={300} disabled={expanded}>
        {button}
      </Tooltip>
    );
  },
);

interface ActivityLinkProps {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  expanded: boolean;
}

function ActivityLink({ href, label, Icon, active, expanded }: ActivityLinkProps) {
  return (
    <Tooltip label={label} position="right" withArrow openDelay={300} disabled={expanded}>
      <Button
        component={Link}
        href={href}
        variant="subtle"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
          active && "bg-surface-2 text-foreground",
        )}
        styles={activityButtonStyles}
      >
        <ActivityContent
          label={label}
          Icon={Icon}
          expanded={expanded}
          active={active}
        />
      </Button>
    </Tooltip>
  );
}