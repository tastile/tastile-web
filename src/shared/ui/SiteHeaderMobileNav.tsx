"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { Button, Drawer } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Menu, X } from "lucide-react";
import Link from "next/link";

interface SiteHeaderMobileNavProps {
  translations: {
    pricing: string;
    download: string;
    login: string;
    getStarted: string;
  };
  hideAuth?: boolean;
}

export function SiteHeaderMobileNav({ translations, hideAuth }: SiteHeaderMobileNavProps) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button
        type="button"
        variant="subtle"
        size="sm"
        aria-label={t("nav.openMenuAria")}
        onClick={open}
        className="sm:hidden inline-flex items-center justify-center rounded-md p-1.5 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="min(18rem, 90vw)"
        withCloseButton
        closeButtonProps={{
          icon: <X className="h-4 w-4" />,
          "aria-label": t("nav.closeMenuAria"),
        }}
        title={t("nav.menuTitle")}
        transitionProps={{ transition: "slide-left", duration: 240 }}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        classNames={{ content: "rounded-l-md" }}
        lockScroll
        trapFocus
        closeOnEscape
        closeOnClickOutside
      >
        <nav className="flex flex-col gap-1">
          <Link
            href="/pricing"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground"
          >
            {translations.pricing}
          </Link>
          <Link
            href="/download"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground"
          >
            {translations.download}
          </Link>
          {!hideAuth && (
            <>
              <Link
                href="/login"
                onClick={close}
                className="rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground"
              >
                {translations.login}
              </Link>
              <Link
                href="/login"
                onClick={close}
                className="mt-2 rounded-full bg-foreground px-4 py-2 text-center text-sm font-medium text-background hover:bg-interactive-hover"
              >
                {translations.getStarted}
              </Link>
            </>
          )}
        </nav>
      </Drawer>
    </>
  );
}