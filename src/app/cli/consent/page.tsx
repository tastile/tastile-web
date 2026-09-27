import { cookies, headers } from "next/headers";

import { loadPendingConsent } from "@/shared/auth/cli/pending-consent-store";
import { getTranslation } from "@/shared/i18n/get-translation";
import { LOCALE_COOKIE } from "@/shared/i18n/locale-cookie";
import { resolveLocale } from "@/shared/i18n/resolve-locale";
import type { Locale } from "@/shared/stores/locale-store";

// /cli/consent — Server Component (Issue #153, plan D6).
//
// Renders the consent UI for a pending consent row identified by `tid`.
// Missing / expired / consumed rows render an explanatory page (NOT a 410,
// because Server Components cannot reliably emit 410 without throwing,
// which Next handles as a 500; the dedicated 410 lives in the POST
// handler).
//
// The form posts back to /cli/consent (next file) with the `tid` and a
// `decision` of `allow` or `deny` as hidden fields.
//
// DS v2 compliance: no Mantine `Card` / `withBorder` (forbidden by
// `localRules/no-mantine-border`); no raw `border-*` Tailwind classes
// (forbidden by `localRules/no-token-violations`). Visual hierarchy
// comes from `bg-surface-elevated`.

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tid?: string }>;
}

export default async function ConsentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const queryLang = typeof params?.tid === "string" ? undefined : undefined;
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  const acceptLanguage = (await headers()).get("accept-language");
  const locale: Locale = resolveLocale({ queryLang, cookieValue, acceptLanguage });
  const tid = typeof params?.tid === "string" ? params.tid : null;

  if (!tid) {
    return (
      <ConsentShell>
        <ErrorBlock
          title={getTranslation(locale, "cliAuth.errorMissingTitle")}
          body={getTranslation(locale, "cliAuth.errorMissingBody")}
        />
      </ConsentShell>
    );
  }

  const pending = await loadPendingConsent(tid);
  if (pending.status !== "ok") {
    return (
      <ConsentShell>
        <ErrorBlock
          title={titleFor(pending.status, locale)}
          body={bodyFor(pending.status, locale)}
        />
      </ConsentShell>
    );
  }

  const clientId = pending.clientId;
  const scopesEffective = pending.scopesEffective;
  return (
    <ConsentShell>
      <article className="w-full max-w-md rounded-xl bg-surface-elevated p-5 sm:p-6">
        <h1 className="text-xl font-semibold">
          {getTranslation(locale, "cliAuth.pageTitle")}
        </h1>
        <p className="mt-2 text-sm">
          <strong>{getTranslation(locale, "cliAuth.clientId")}:</strong>{" "}
          <code className="font-mono">{clientId}</code>
        </p>
        <h2 className="mt-4 text-base font-medium">
          {getTranslation(locale, "cliAuth.requestingScopes")}
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          {scopesEffective.split(" ").filter(Boolean).map((scope) => (
            <li key={scope}>
              <code className="font-mono">{scope}</code> —{" "}
              {scopeLabel(scope, locale)}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          {getTranslation(locale, "cliAuth.scopesNote")}
        </p>
        <form method="POST" action="/cli/consent" className="mt-6 flex gap-2">
          <input type="hidden" name="tid" value={tid} />
          <button
            type="submit"
            name="decision"
            value="allow"
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-hover"
          >
            {getTranslation(locale, "cliAuth.allow")}
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="rounded bg-surface px-4 py-2 text-foreground hover:bg-surface-hover"
          >
            {getTranslation(locale, "cliAuth.deny")}
          </button>
        </form>
      </article>
    </ConsentShell>
  );
}

function ConsentShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      {children}
    </main>
  );
}

function ErrorBlock({ title, body }: { title: string; body: string }) {
  return (
    <article className="w-full max-w-md rounded-xl bg-surface-elevated p-5 sm:p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </article>
  );
}

function titleFor(
  status: "missing" | "expired" | "consumed",
  locale: Locale,
): string {
  if (status === "expired") return getTranslation(locale, "cliAuth.errorExpiredTitle");
  if (status === "consumed") return getTranslation(locale, "cliAuth.errorConsumedTitle");
  return getTranslation(locale, "cliAuth.errorMissingTitle");
}

function bodyFor(
  status: "missing" | "expired" | "consumed",
  locale: Locale,
): string {
  if (status === "expired") return getTranslation(locale, "cliAuth.errorExpiredBody");
  if (status === "consumed") return getTranslation(locale, "cliAuth.errorConsumedBody");
  return getTranslation(locale, "cliAuth.errorMissingBody");
}

function scopeLabel(
  scope: string,
  locale: Locale,
): string {
  switch (scope) {
    case "tastile.read":
      return getTranslation(locale, "cliAuth.scopesRead");
    case "tastile.write":
      return getTranslation(locale, "cliAuth.scopesWrite");
    default:
      return scope;
  }
}
