"use client";

import { ChevronUp } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface AccountMenuProps {
  displayName: string;
  avatarUrl: string | null;
  plan: string;
  email: string;
  menuPlacement?: "up" | "down" | "right";
}

export function AccountMenu({
  displayName,
  avatarUrl,
  plan,
  email,
  menuPlacement = "down",
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    // Use the Cognito Hosted UI logout endpoint — clears server cookies
    // and ends the Cognito session in the browser.
    router.push("/auth/cognito/logout");
  }

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const menuPositionClass =
    menuPlacement === "up"
      ? "right-0 bottom-full mb-2 origin-bottom"
      : menuPlacement === "right"
        ? "left-full bottom-0 ml-2 origin-bottom-left"
        : "right-0 top-full mt-2 origin-top";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="shrink-0 flex items-center gap-1.5 rounded-full px-1 focus:outline-none focus:ring-2 focus:ring-foreground/20"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={28}
            height={28}
            className="block h-7 w-7 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
            unoptimized
          />
        ) : (
          <div className="h-7 w-7 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-xs font-medium text-foreground-muted">
            {initials}
          </div>
        )}
        <ChevronUp
          size={12}
          className={`text-foreground-muted transition-transform duration-200 ${open ? "rotate-0" : "rotate-180"}`}
          aria-hidden
        />
      </button>

      <div
        className={`absolute ${menuPositionClass} z-50 w-64 rounded-xl bg-surface-elevated transition-all duration-200 ${
          open
            ? "pointer-events-auto opacity-100 translate-y-0 scale-100"
            : "pointer-events-none opacity-0 translate-y-1 scale-95"
        }`}
      >
        <div className="p-4">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={40}
                height={40}
                className="block h-10 w-10 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
                unoptimized
              />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-sm font-medium text-foreground-muted">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <p className="text-xs text-foreground-muted truncate">{email}</p>
            </div>
          </div>
          <div className="mt-2">
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                plan === "pro" ? "bg-primary/10 text-primary" : "bg-surface-2 text-foreground-muted"
              }`}
            >
              {plan === "pro" ? "Pro" : "Free"}
            </span>
          </div>
        </div>

        <div className="py-1">
          <a
            href="/dashboard/preferences/account"
            className="block px-4 py-2 text-sm text-foreground-muted hover:bg-surface-2"
          >
            Account settings
          </a>
          <a
            href={plan === "pro" ? "/dashboard/billing" : "/pricing"}
            className="block px-4 py-2 text-sm text-foreground-muted hover:bg-surface-2"
          >
            {plan === "pro" ? "Billing" : "Upgrade to Pro"}
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-surface-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
