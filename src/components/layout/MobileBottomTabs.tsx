"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";
import { Button } from "@mantine/core";
import { Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileBottomTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { open } = useQuickCreateStore();

  return (
    <nav className="mx-4 mb-4 flex h-16 items-center justify-around rounded-xl bg-surface-elevated lg:hidden">
      <MobileActionButton icon={<Plus className="h-6 w-6" />} label={t("nav.new")} onClick={open} />
      <MobileTabButton
        icon={<Settings className="h-6 w-6" />}
        label={t("nav.settings")}
        href="/dashboard/preferences/general"
        active={pathname?.startsWith("/dashboard/preferences") ?? false}
      />
    </nav>
  );
}

interface MobileTabButtonProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
}

function MobileTabButton({ icon, label, href, active }: MobileTabButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-md px-4 py-2",
        active ? "text-foreground" : "text-foreground-muted",
      )}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Link>
  );
}

interface MobileActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function MobileActionButton({ icon, label, onClick }: MobileActionButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-md px-4 py-2 text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}
