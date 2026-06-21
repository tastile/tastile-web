"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  Layers,
  PanelLeftDashed,
  Plus,
  Repeat,
  Library,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { useShellStore, type SidebarBehavior } from "@/lib/stores/shell-store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  path: string;
  label: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard/calendar",   label: "Timeline",   Icon: CalendarDays },
  { path: "/dashboard/tasks",      label: "Tasks",      Icon: CheckSquare  },
  { path: "/dashboard/projects",   label: "Projects",   Icon: Layers       },
  { path: "/dashboard/schedule",   label: "Schedule",   Icon: Repeat       },
  { path: "/dashboard/references", label: "References", Icon: Library      },
];

export function ActivityBar() {
  const pathname = usePathname();
  const openQuickCreate = useQuickCreateStore((s) => s.open);
  const { t } = useTranslation();
  const sidebarBehavior = useShellStore((s) => s.sidebarBehavior);
  const setSidebarBehavior = useShellStore((s) => s.setSidebarBehavior);
  const [hovered, setHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 実際に展開するか判定
  const expanded =
    sidebarBehavior === "open" ||
    (sidebarBehavior === "expandable" && hovered);

  return (
    <div
      className={cn(
        "relative shrink-0 transition-[width] duration-200 ease-in-out z-20",
        sidebarBehavior === "open" ? "w-48" : "w-12"
      )}
    >
      <nav
        aria-label="Activity bar"
        className={cn(
          "absolute inset-y-0 left-0 flex flex-col items-stretch bg-surface-0",
          "border-r border-border overflow-hidden",
          "transition-[width] duration-200 ease-in-out",
          expanded ? "w-48" : "w-12",
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
      {/* タスク作成ボタン — アクセントカラー */}
      <div className="px-1 pt-1">
        <NavButton
          label={t("nav.new")}
          Icon={Plus}
          expanded={expanded}
          onClick={openQuickCreate}
          className="bg-primary/10 text-primary hover:bg-primary/20"
        />
      </div>

      {/* ナビゲーション項目 */}
      <div className="flex flex-1 flex-col gap-0.5 px-1 pt-2 overflow-hidden">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const active = pathname === path || pathname.startsWith(path + "/");
          return (
            <NavLink
              key={path}
              href={path}
              label={label}
              Icon={Icon}
              active={active}
              expanded={expanded}
            />
          );
        })}
      </div>

      {/* 開閉コントロール — 下揃え */}
      <div className="relative px-1 pb-1">
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label="Sidebar control"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          className={cn(
            "relative flex h-10 w-full items-center overflow-hidden rounded-md",
            "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
            "transition-colors",
          )}
        >
          <span className="absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center">
            <PanelLeftDashed className="h-4 w-4" aria-hidden />
          </span>
          <span
            className={cn(
              "absolute left-10 whitespace-nowrap text-sm",
              "transition-[opacity,transform] duration-200",
              expanded
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-2 pointer-events-none",
            )}
          >
            Sidebar
          </span>
        </button>

        {/* ドロップダウンメニュー */}
        {dropdownOpen && (
          <>
            {/* オーバーレイ（外クリックで閉じる）*/}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
              aria-hidden
            />
            <div
              role="menu"
              className={cn(
                "absolute bottom-full left-1 z-50 mb-1",
                "w-44 rounded-lg border border-border bg-surface-elevated shadow-lg",
                "py-1",
              )}
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                Sidebar control
              </div>
              <div className="mx-2 my-1 h-px bg-border" />
              {(
                [
                  { value: "open",       label: "Expanded"       },
                  { value: "closed",     label: "Collapsed"      },
                  { value: "expandable", label: "Expand on hover" },
                ] as { value: SidebarBehavior; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  role="menuitemradio"
                  aria-checked={sidebarBehavior === value}
                  type="button"
                  onClick={() => {
                    setSidebarBehavior(value);
                    setDropdownOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-sm",
                    "hover:bg-surface-2 transition-colors",
                    sidebarBehavior === value
                      ? "text-foreground font-medium"
                      : "text-foreground-subtle",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                      sidebarBehavior === value
                        ? "border-primary bg-primary"
                        : "border-foreground-subtle",
                    )}
                  >
                    {sidebarBehavior === value && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-fg" />
                    )}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </nav>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// NavButton (icon + label for non-link buttons e.g. + button)
// ──────────────────────────────────────────────────────────────────────────────
interface NavButtonProps {
  label: string;
  Icon: LucideIcon;
  expanded: boolean;
  onClick: () => void;
  className?: string;
}

function NavButton({ label, Icon, expanded, onClick, className }: NavButtonProps) {
  return (
    <div className="group/item relative">
      <button
        type="button"
        title={label}
        onClick={onClick}
        className={cn(
          "relative flex h-10 w-full items-center overflow-hidden rounded-md transition-colors",
          className,
        )}
      >
        <span className="absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span
          className={cn(
            "absolute left-10 whitespace-nowrap text-sm font-medium",
            "transition-[opacity,transform] duration-200",
            expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none",
          )}
        >
          {label}
        </span>
      </button>

      {/* ホバーツールチップ (折りたたみ時) */}
      {!expanded && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2",
            "whitespace-nowrap rounded-md bg-surface-elevated px-2.5 py-1.5",
            "text-xs font-medium text-foreground shadow-md border border-border",
            "opacity-0 group-hover/item:opacity-100 transition-opacity duration-150",
          )}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// NavLink
// ──────────────────────────────────────────────────────────────────────────────
interface NavLinkProps {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  expanded: boolean;
}

function NavLink({ href, label, Icon, active, expanded }: NavLinkProps) {
  return (
    <div className="relative group/item">
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-10 w-full items-center overflow-hidden rounded-md",
          "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
          "transition-colors",
          active && "bg-surface-2 text-foreground",
        )}
      >
        {/* アクティブインジケーター */}
        {active && (
          <span
            aria-hidden
            className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary"
          />
        )}
        {/* アイコン */}
        <span className="absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center">
          <Icon
            className={cn("h-4 w-4", active ? "text-primary" : "")}
            aria-hidden
          />
        </span>
        {/* ラベル (展開時のみ) */}
        <span
          className={cn(
            "absolute left-10 whitespace-nowrap text-sm",
            "transition-[opacity,transform] duration-200",
            active
              ? "text-foreground"
              : "text-foreground-subtle group-hover/item:text-foreground",
            expanded
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-2 pointer-events-none",
          )}
        >
          {label}
        </span>
      </Link>

      {/* ホバーツールチップ (折りたたみ時のみ) */}
      {!expanded && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2",
            "whitespace-nowrap rounded-md bg-surface-elevated px-2.5 py-1.5",
            "text-xs font-medium text-foreground shadow-md border border-border",
            "opacity-0 group-hover/item:opacity-100 transition-opacity duration-150",
          )}
        >
          {label}
        </div>
      )}
    </div>
  );
}
