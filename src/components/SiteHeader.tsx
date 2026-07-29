import Link from "next/link";
import { TastileLogo } from "@/components/TastileLogo";

export function SiteHeader({
  hideAuth,
  translations,
}: {
  hideAuth?: boolean;
  showFeatureLink?: boolean;
  translations: {
    features: string;
    pricing: string;
    download: string;
    login: string;
    getStarted: string;
  };
}) {
  return (
    <header className="sticky top-9 z-40 bg-surface-0/90 backdrop-blur-sm">
      <div className="layout-shell flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <TastileLogo size={36} className="text-foreground" />
          <span className="text-xl font-semibold tracking-tight text-foreground">tastile</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/pricing"
            className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block"
          >
            {translations.pricing}
          </Link>
          <Link
            href="/download"
            className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block"
          >
            {translations.download}
          </Link>
          {!hideAuth && (
            <>
              <Link
                href="/login"
                className="hidden rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-2 hover:text-foreground sm:block"
              >
                {translations.login}
              </Link>
              <Link
                href="/login"
                className="ml-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-interactive-hover"
              >
                {translations.getStarted}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
