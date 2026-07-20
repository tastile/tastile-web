"use client";

import { KeyRound, Mail, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AccessTokenSection } from "@/components/account/AccessTokenSection";
import { SubscriptionSection } from "@/components/account/SubscriptionSection";
import { PreferencesSidePanel } from "@/components/panels/PreferencesSidePanel";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTranslation } from "@/lib/i18n/use-translation";

export type TabId = "profile" | "subscription" | "tokens";

type Profile = {
  username: string;
  sub: string | null;
  email: string | null;
  emailVerified: boolean;
  preferredUsername: string | null;
};

type Notice = { tone: "success" | "error"; text: string } | null;

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-foreground-subtle">Loading account settings...</div>
      }
    >
      <AccountPageInner />
    </Suspense>
  );
}

function AccountPageInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) || "profile";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sidePanel = useMemo(() => <PreferencesSidePanel />, []);
  useSidePanel(sidePanel);

  async function loadProfile() {
    setLoading(true);
    setNotice(null);
    const response = await fetch("/api/account/profile", { cache: "no-store" });
    if (!response.ok) {
      setNotice({
        tone: "error",
        text: t("preferences.account.notice.loadFailed"),
      });
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { profile: Profile };
    setProfile(body.profile);
    setPendingEmail(body.profile.email ?? "");
    setLoading(false);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadProfile is intentionally only invoked once on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: loadProfile is called exactly once on mount
  }, []);

  const accountId = useMemo(() => profile?.sub ?? profile?.username ?? "-", [profile]);

  async function handleEmailStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/account/email/start", {
      method: "POST",
      body: form,
    });
    setSubmitting(false);
    if (!response.ok) {
      setNotice({
        tone: "error",
        text: t("preferences.account.notice.emailStartFailed"),
      });
      return;
    }
    setNotice({
      tone: "success",
      text: t("preferences.account.notice.emailStartSent"),
    });
  }

  async function handleEmailVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/account/email/verify", {
      method: "POST",
      body: form,
    });
    setSubmitting(false);
    if (!response.ok) {
      setNotice({
        tone: "error",
        text: t("preferences.account.notice.emailVerifyFailed"),
      });
      return;
    }
    setVerificationCode("");
    setNotice({ tone: "success", text: t("preferences.account.notice.emailUpdated") });
    await loadProfile();
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 sm:p-8">
      <h1 className="text-2xl font-normal text-foreground">{t("preferences.account.title")}</h1>

      <div className="max-w-4xl">
        {activeTab === "profile" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {t("preferences.account.profileHeading")}
              </h2>
              <p className="mt-1 text-foreground-muted">{t("preferences.account.profileGuide")}</p>
            </div>

            {notice && (
              <div
                className={`rounded-md px-4 py-3 text-sm ${
                  notice.tone === "success"
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {notice.text}
              </div>
            )}

            <section className="border border-border bg-surface-0 rounded-md p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <UserRound className="h-5 w-5 text-foreground-muted" aria-hidden="true" />
                  <h3 className="font-semibold text-foreground">
                    {t("preferences.account.accountHeading")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void loadProfile()}
                  className="inline-flex items-center gap-2 rounded-full bg-surface-3 px-3 py-2 text-sm font-semibold text-foreground"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t("preferences.account.refresh")}
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-foreground-subtle">{t("preferences.account.loading")}</p>
              ) : (
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-foreground-subtle">{t("preferences.account.email")}</dt>
                    <dd className="mt-1 font-medium text-foreground">{profile?.email ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground-subtle">
                      {t("preferences.account.emailVerified")}
                    </dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {profile?.emailVerified
                        ? t("preferences.account.verified")
                        : t("preferences.account.unverified")}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-foreground-subtle">{t("preferences.account.accountId")}</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-foreground">
                      {accountId}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="border border-border bg-surface-0 rounded-md p-6">
              <div className="mb-4 flex items-center gap-3">
                <Mail className="h-5 w-5 text-foreground-muted" aria-hidden="true" />
                <h3 className="font-semibold text-foreground">
                  {t("preferences.account.changeEmailHeading")}
                </h3>
              </div>
              <form onSubmit={handleEmailStart} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="text-sm">
                  <span className="mb-2 block font-medium text-foreground">
                    {t("preferences.account.newEmail")}
                  </span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={pendingEmail}
                    onChange={(event) => setPendingEmail(event.target.value)}
                    className="w-full rounded-md border border-border bg-surface-0 px-3 py-3 text-foreground outline-none focus:border-primary"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="self-end rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60"
                >
                  {t("preferences.account.sendCode")}
                </button>
              </form>

              <form
                onSubmit={handleEmailVerify}
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
              >
                <label className="text-sm">
                  <span className="mb-2 block font-medium text-foreground">
                    {t("preferences.account.code")}
                  </span>
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    className="w-full rounded-md border border-border bg-surface-0 px-3 py-3 text-foreground outline-none focus:border-primary"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="self-end rounded-full bg-surface-3 px-4 py-3 text-sm font-semibold text-foreground disabled:opacity-60"
                >
                  {t("preferences.account.verifyCode")}
                </button>
              </form>
            </section>

            <section className="border border-border bg-surface-0 rounded-md p-6">
              <div className="mb-4 flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-foreground-muted" aria-hidden="true" />
                <h3 className="font-semibold text-foreground">
                  {t("preferences.account.loginMethods")}
                </h3>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="/auth/cognito/login?next=/dashboard/account"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {t("preferences.account.passkey")}
                </a>
                <Link
                  href="/auth/email"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-surface-3 px-4 py-3 text-sm font-semibold text-foreground"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {t("preferences.account.emailOtpRelogin")}
                </Link>
              </div>
            </section>
          </div>
        )}

        {activeTab === "subscription" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              {t("preferences.account.subscriptionHeading")}
            </h2>
            <p className="text-foreground-muted">{t("preferences.account.subscriptionGuide")}</p>
            <SubscriptionSection />
          </div>
        )}

        {activeTab === "tokens" && <AccessTokenSection />}
      </div>
    </div>
  );
}
