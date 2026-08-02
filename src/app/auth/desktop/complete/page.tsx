import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";
import { TastileLogo } from "@/shared/ui/TastileLogo";
import { Laptop, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function DesktopAuthCompletePage() {
  const script = `
(() => {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const redirectUri = fragment.get('redirect_uri');
  const state = fragment.get('state');
  const idToken = fragment.get('id_token');
  const accessToken = fragment.get('access_token');
  if (!redirectUri || !state || !idToken || !accessToken) {
    document.documentElement.dataset.desktopAuth = 'missing';
    return;
  }
  fragment.delete('redirect_uri');
  fragment.delete('state');
  const callback = redirectUri + '?state=' + encodeURIComponent(state) + '#' + fragment.toString();
  const manual = document.getElementById('desktop-callback-link');
  if (manual) manual.setAttribute('href', callback);
  window.setTimeout(() => {
    window.location.href = callback;
  }, 350);
})();
`;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader hideAuth translations={getHeaderTranslations("en")} />

      <main className="layout-shell flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-xl rounded-lg bg-surface-elevated p-8">
          <div className="flex items-center gap-4">
            <TastileLogo size={64} className="text-foreground" />
            <div>
              <p className="text-sm font-medium text-primary">Tastile Desktop</p>
              <h1 className="mt-1 text-3xl font-semibold text-foreground">
                Authentication complete
              </h1>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex gap-3 rounded-lg bg-surface-0 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-6 text-foreground-muted">
                Your account has been verified. Returning to the Desktop app to save the session.
              </p>
            </div>
            <div className="flex gap-3 rounded-lg bg-surface-0 p-4">
              <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-6 text-foreground-muted">
                If your browser asks for confirmation, please allow it to open Tastile.
              </p>
            </div>
          </div>

          <a
            id="desktop-callback-link"
            href="tastile://auth/callback"
            className="mt-8 flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          >
            Open the Desktop app
          </a>
          <p className="mt-4 text-center text-xs leading-5 text-foreground-subtle">
            If the app does not open, you can manage your account from the{" "}
            <Link className="underline hover:text-foreground" href="/dashboard/preferences/account">
              web account settings
            </Link>
            .
          </p>
        </div>
      </main>

      <SiteFooter translations={getFooterTranslations("en")} />
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: deeplink-redirect reads URL fragment and must run inline before paint — cannot be ref'd to a JS file */}
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </div>
  );
}
