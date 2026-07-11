import { getFooterTranslations, getHeaderTranslations } from "@/lib/i18n/server-translations";
import { AuthShell } from "../auth-shell";

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    redirect_uri?: string;
    state?: string;
  }>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const redirectUri = typeof params.redirect_uri === "string" ? params.redirect_uri : "";
  const state = typeof params.state === "string" ? params.state : "";

  return (
    <AuthShell
      title="メールでログイン"
      subtitle="メールアドレスを入力してください。パスワードまたは確認コードをお送りします。"
      message={error ? decodeURIComponent(error) : null}
      headerTranslations={getHeaderTranslations("ja")}
      footerTranslations={getFooterTranslations("ja")}
    >
      <form action="/auth/email/start" method="post" className="space-y-5">
        {redirectUri ? <input type="hidden" name="redirect_uri" value={redirectUri} /> : null}
        {state ? <input type="hidden" name="state" value={state} /> : null}
        <div>
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          続行
        </button>
      </form>
    </AuthShell>
  );
}
