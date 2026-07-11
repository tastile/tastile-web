import { Laptop, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TastileLogo } from "@/components/TastileLogo";
import { getFooterTranslations, getHeaderTranslations } from "@/lib/i18n/server-translations";

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
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader hideAuth translations={getHeaderTranslations("ja")} />

      <main className="layout-shell flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-xl rounded-lg bg-surface-elevated p-8">
          <div className="flex items-center gap-4">
            <TastileLogo size={64} className="text-foreground" />
            <div>
              <p className="text-sm font-medium text-primary">Tastile Desktop</p>
              <h1 className="mt-1 text-3xl font-semibold text-foreground">認証が完了しました</h1>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex gap-3 rounded-lg bg-surface-0 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-6 text-foreground-muted">
                アカウント認証に成功しました。Desktop アプリへ戻してセッションを保存しています。
              </p>
            </div>
            <div className="flex gap-3 rounded-lg bg-surface-0 p-4">
              <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-6 text-foreground-muted">
                ブラウザが確認を求めた場合は Tastile を開く操作を許可してください。
              </p>
            </div>
          </div>

          <a
            id="desktop-callback-link"
            href="tastile://auth/callback"
            className="mt-8 flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          >
            Desktop アプリを開く
          </a>
          <p className="mt-4 text-center text-xs leading-5 text-foreground-subtle">
            アプリに戻れない場合は{" "}
            <Link className="underline hover:text-foreground" href="/dashboard/preferences/account">
              Web アカウント設定
            </Link>{" "}
            を開けます。
          </p>
        </div>
      </main>

      <SiteFooter translations={getFooterTranslations("ja")} />
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: deeplink redirect runs only on this auth-complete page */}
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </div>
  );
}
