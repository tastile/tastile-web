import { TastileLogo } from "@/shared/ui/TastileLogo";
import Link from "next/link";

export function SiteFooter({
  translations,
}: {
  translations: {
    webApp: string;
    download: string;
    pricing: string;
    privacy: string;
    terms: string;
    tokushoho: string;
    copyright: string;
  };
}) {
  return (
    <footer className="bg-surface-0 py-10">
      <div className="layout-shell grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
        <Link href="/" className="flex items-center gap-3">
          <TastileLogo size={34} className="text-foreground" />
          <span className="text-xl font-semibold tracking-tight text-foreground">tastile</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground-muted">
          <Link href="/login" className="hover:text-foreground">
            {translations.webApp}
          </Link>
          <Link href="/download" className="hover:text-foreground">
            {translations.download}
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            {translations.pricing}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {translations.privacy}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {translations.terms}
          </Link>
          <Link href="/tokushoho" className="hover:text-foreground">
            {translations.tokushoho}
          </Link>
        </nav>
        <p className="text-xs text-foreground-subtle md:text-right">{translations.copyright}</p>
      </div>
    </footer>
  );
}
