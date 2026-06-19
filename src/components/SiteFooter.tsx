"use client";

import Link from "next/link";
import { TastileLogo } from "@/components/TastileLogo";
import { useTranslation } from "@/lib/i18n/use-translation";

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="bg-surface-0 py-10">
      <div className="layout-shell grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
        <Link href="/" className="flex items-center gap-3">
          <TastileLogo size={34} className="text-foreground" />
          <span className="text-xl font-semibold tracking-tight text-foreground">tastile</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground-muted">
          <Link href="/login" className="hover:text-foreground">
            {t("marketing.nav.webApp")}
          </Link>
          <Link href="/download" className="hover:text-foreground">
            {t("marketing.nav.download")}
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            {t("marketing.nav.pricing")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {t("marketing.nav.privacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t("marketing.nav.terms")}
          </Link>
        </nav>
        <p className="text-xs text-foreground-subtle md:text-right">
          {t("marketing.footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
