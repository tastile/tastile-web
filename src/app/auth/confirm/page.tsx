import { getFooterTranslations, getHeaderTranslations } from "@/lib/i18n/server-translations";
import { AuthShell } from "../auth-shell";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    error?: string;
    redirect_uri?: string;
    state?: string;
  }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <AuthShell
      title="アカウントを確認"
      subtitle="メールに送信された確認コードを入力してください。"
      message={error ? decodeURIComponent(error) : null}
      headerTranslations={getHeaderTranslations("ja")}
      footerTranslations={getFooterTranslations("ja")}
    >
      <form action="/auth/email/confirm" method="post" className="space-y-5">
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
            defaultValue={email}
            className="mt-2 w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="code" className="text-sm font-medium text-foreground">
            確認コード
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            required
            className="mt-2 w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="6 桁のコード"
          />
        </div>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          確認する
        </button>
      </form>
    </AuthShell>
  );
}
