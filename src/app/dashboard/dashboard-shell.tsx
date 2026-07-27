"use client";

import { ActionIcon, Button, NavLink } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { clearCachedCognitoSession } from "@/lib/cognito/session";

type DashboardShellProps = {
  children: React.ReactNode;
  plan: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
};

const RAIL_PINNED_KEY = "dashboard-rail-pinned";
const TOOL_NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/tiles", label: "Tiles", icon: BarChart3 },
  { href: "/dashboard/history", label: "History", icon: History },
];

function readPinnedPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(RAIL_PINNED_KEY) === "1";
}

export function DashboardShell({
  children,
  plan,
  displayName,
  avatarUrl,
  email,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pinnedOpen, { open: openPinned, close: closePinned }] =
    useDisclosure(readPinnedPreference());
  const [hoverOpen, { open: openHover, close: closeHover }] = useDisclosure(false);
  const [mobileOpen, { open: openMobile, close: closeMobile, toggle: toggleMobile }] =
    useDisclosure(false);
  const [accountOpen, { open: openAccount, close: closeAccount, toggle: toggleAccount }] =
    useDisclosure(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(RAIL_PINNED_KEY, pinnedOpen ? "1" : "0");
  }, [pinnedOpen]);

  const desktopExpanded = pinnedOpen || hoverOpen;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(event.target as Node)) {
        closeAccount();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [closeAccount]);

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    clearCachedCognitoSession();
    router.push("/auth/cognito/logout");
  }

  function handleAccountToggle() {
    if (!desktopExpanded && typeof window !== "undefined" && window.innerWidth >= 1024) {
      openPinned();
      openAccount();
      return;
    }

    toggleAccount();
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="flex min-h-dvh">
        <aside
          onMouseEnter={openHover}
          onMouseLeave={() => {
            closeHover();
            closeAccount();
          }}
          className={[
            "fixed inset-y-0 left-0 z-40 bg-surface-1 transition-[width,transform] duration-300 ease-out",
            mobileOpen ? "w-64" : desktopExpanded ? "w-64" : "w-16",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
            "lg:static lg:translate-x-0",
          ].join(" ")}
        >
          <div className="flex h-full flex-col px-2 py-3">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  toggleMobile();
                } else {
                  if (pinnedOpen) {
                    closePinned();
                    closeAccount();
                  } else {
                    openPinned();
                  }
                }
              }}
              className="mb-2 self-start"
              aria-label="Toggle navigation rail"
            >
              <MenuIcon size={18} />
            </ActionIcon>
            <nav>
              {TOOL_NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    component={Link}
                    leftSection={<Icon size={18} />}
                    label={desktopExpanded ? item.label : undefined}
                    active={active}
                    onClick={closeMobile}
                    className="mb-1"
                    title={item.label}
                    styles={{
                      root: {
                        borderRadius: "var(--mantine-radius-md)",
                        height: 40,
                      },
                    }}
                  />
                );
              })}
            </nav>

            <div className="mt-auto pt-4">
              <div ref={accountMenuRef} data-testid="account-trigger-zone" className="mt-3 px-0">
                <div className="relative">
                  <div
                    data-testid="account-popover"
                    className={[
                      "grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out",
                      desktopExpanded && accountOpen
                        ? "mb-1 grid-rows-[1fr] opacity-100"
                        : "mb-0 grid-rows-[0fr] opacity-0",
                    ].join(" ")}
                  >
                    <div className="min-h-0 space-y-1 overflow-hidden">
                      <Link
                        href="/dashboard/settings"
                        onClick={closeAccount}
                        className={[
                          "flex h-9 items-center gap-2 rounded-md px-3 text-sm",
                          pathname === "/dashboard/settings"
                            ? "border border-border bg-surface-2 text-foreground"
                            : "text-foreground-muted hover:bg-surface-2 hover:text-foreground",
                        ].join(" ")}
                      >
                        <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                          <Settings size={16} />
                        </span>
                        <span>Account settings</span>
                      </Link>

                      <Link
                        href={plan === "pro" ? "/dashboard/billing" : "/pricing"}
                        onClick={closeAccount}
                        className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground"
                      >
                        <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                          <CreditCard size={16} />
                        </span>
                        <span>{plan === "pro" ? "Billing" : "Upgrade to Pro"}</span>
                      </Link>

                      <Button
                        type="button"
                        onClick={() => {
                          closeAccount();
                          void handleSignOut();
                        }}
                        className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
                      >
                        <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                          <LogOut size={16} />
                        </span>
                        <span>Sign out</span>
                      </Button>
                    </div>
                  </div>

                  <Button
                    data-testid="account-trigger-button"
                    aria-expanded={desktopExpanded && accountOpen}
                    title={email}
                    onClick={handleAccountToggle}
                    className="mb-1 w-full"
                    styles={{
                      root: {
                        borderRadius: "var(--mantine-radius-md)",
                        height: 40,
                        padding: "0 var(--mantine-spacing-xs)",
                      },
                    }}
                  >
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={displayName}
                        width={28}
                        height={28}
                        className="block h-7 w-7 shrink-0 aspect-square rounded-full object-cover"
                        referrerPolicy="no-referrer"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 aspect-square items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-medium text-foreground-muted">
                        {initials}
                      </div>
                    )}

                    <div
                      className={[
                        "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,margin,opacity,transform] duration-300 ease-out",
                        desktopExpanded
                          ? "ml-3 max-w-28 opacity-100 translate-x-0"
                          : "ml-0 max-w-0 opacity-0 -translate-x-1",
                      ].join(" ")}
                    >
                      <p className="truncate text-[12px] font-medium text-foreground">
                        {displayName}
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-foreground-subtle">
                        {plan}
                      </p>
                    </div>

                    <span
                      className={[
                        "ml-auto overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out",
                        desktopExpanded
                          ? "max-w-8 opacity-100 translate-x-0"
                          : "max-w-0 opacity-0 translate-x-1",
                      ].join(" ")}
                    >
                      {accountOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default border-none bg-black/20 lg:hidden"
            onClick={closeMobile}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeMobile();
            }}
            aria-label="Close navigation rail"
          />
        ) : null}

        <div className="flex min-h-dvh flex-1 flex-col transition-colors duration-200">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-background px-4 backdrop-blur lg:px-6">
            <div className="flex items-center gap-2">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={openMobile}
                aria-label="Open navigation rail"
                className="lg:hidden"
              >
                <MenuIcon size={18} />
              </ActionIcon>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
                Execution Dashboard
              </span>
            </div>
            <Link
              href="/"
              className="text-xs font-medium text-foreground-muted hover:text-foreground"
            >
              Back to Home
            </Link>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-310">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
