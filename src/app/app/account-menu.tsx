"use client";

import { Button } from "@mantine/core";
import { ChevronUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FloatingMenu,
  FloatingMenuContent,
  FloatingMenuItem,
  FloatingMenuLabel,
  FloatingMenuSeparator,
  FloatingMenuTrigger,
} from "@/components/ui/floating-menu";

interface AccountMenuProps {
  displayName: string;
  avatarUrl: string | null;
  plan: string;
  email: string;
  menuPlacement?: "up" | "down";
}

export function AccountMenu({
  displayName,
  avatarUrl,
  plan,
  email,
  menuPlacement = "down",
}: AccountMenuProps) {
  const router = useRouter();
  const side = menuPlacement === "up" ? "top" : "bottom";

  async function handleSignOut() {
    router.push("/auth/cognito/logout");
  }

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <FloatingMenu>
      <FloatingMenuTrigger asChild>
        <Button
          type="button"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-1 focus:outline-none focus:ring-2 focus:ring-foreground/20"
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
            className="text-foreground-muted transition-transform duration-200 data-[state=open]:rotate-0 data-[state=closed]:rotate-180"
            aria-hidden
          />
        </Button>
      </FloatingMenuTrigger>
      <FloatingMenuContent align="end" side={side} className="w-64">
        <FloatingMenuLabel className="font-normal">
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
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${plan === "pro" ? "bg-primary/10 text-primary" : "bg-surface-2 text-foreground-muted"
                }`}
            >
              {plan === "pro" ? "Pro" : "Free"}
            </span>
          </div>
        </FloatingMenuLabel>
        <FloatingMenuSeparator />
        <FloatingMenuItem asChild>
          <Link href="/dashboard/preferences/account" className="w-full">
            Account settings
          </Link>
        </FloatingMenuItem>
        <FloatingMenuItem asChild>
          <Link href={plan === "pro" ? "/dashboard/billing" : "/pricing"} className="w-full">
            {plan === "pro" ? "Billing" : "Upgrade to Pro"}
          </Link>
        </FloatingMenuItem>
        <FloatingMenuSeparator />
        <FloatingMenuItem onSelect={handleSignOut} className="text-danger">
          Sign out
        </FloatingMenuItem>
      </FloatingMenuContent>
    </FloatingMenu>
  );
}
