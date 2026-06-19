import Link from "next/link";
import { TastileLogo } from "@/components/TastileLogo";

export function AuthShell({
  title,
  subtitle,
  message,
  children,
}: {
  title: string;
  subtitle: string;
  message: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <section className="space-y-5">
            <Link href="/" className="inline-flex items-center gap-3">
              <TastileLogo size={52} className="text-foreground" />
              <span className="text-2xl font-semibold text-foreground">tastile</span>
            </Link>
            <div className="space-y-3">
              <p className="text-sm font-medium text-primary">Tastile Account</p>
              <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">{title}</h1>
              <p className="max-w-xl text-base leading-7 text-foreground-muted">{subtitle}</p>
            </div>
          </section>

          <section className="rounded-lg bg-surface-elevated p-6 sm:p-8">
            {message ? (
              <div className="mb-5 rounded-lg bg-surface-0 px-4 py-3 text-sm leading-6 text-foreground-muted">
                {message}
              </div>
            ) : null}
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
