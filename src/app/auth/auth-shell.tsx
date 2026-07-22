import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TastileLogo } from "@/components/TastileLogo";

export function AuthShell({
  title,
  subtitle,
  message,
  children,
  headerTranslations,
  footerTranslations,
}: {
  title: string;
  subtitle: string;
  message: string | null;
  children: React.ReactNode;
  headerTranslations: {
    features: string;
    pricing: string;
    download: string;
    login: string;
    getStarted: string;
  };
  footerTranslations: {
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
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader hideAuth translations={headerTranslations} />

      <main className="layout-shell grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.05fr_1fr]">
        <section className="space-y-5">
          <div className="flex items-center gap-4">
            <TastileLogo size={64} className="text-foreground" />
            <div>
              <p className="text-sm font-medium text-primary">Tastile Account</p>
              <h1 className="mt-1 text-4xl font-semibold text-foreground sm:text-5xl">{title}</h1>
            </div>
          </div>
          <p className="max-w-xl text-lg leading-8 text-foreground-muted">{subtitle}</p>
        </section>

        <section className="w-full rounded-lg bg-surface-elevated p-6 sm:p-8">
          {message ? (
            <div className="mb-5 rounded-lg bg-surface-0 px-4 py-3 text-sm leading-6 text-foreground-muted">
              {message}
            </div>
          ) : null}
          {children}
        </section>
      </main>

      <SiteFooter translations={footerTranslations} />
    </div>
  );
}
