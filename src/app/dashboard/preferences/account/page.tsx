"use client";

import { KeyRound, Mail, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AccessTokenSection } from "@/components/account/AccessTokenSection";
import { SubscriptionSection } from "@/components/account/SubscriptionSection";
import { TileStatistics } from "@/components/account/TileStatistics";
import { UsageDashboard } from "@/components/account/UsageDashboard";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { PreferencesSidePanel } from "@/components/panels/PreferencesSidePanel";

export type TabId = "profile" | "subscription" | "statistics" | "usage" | "tokens";

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
    <Suspense fallback={<div className="p-8 text-sm text-foreground-subtle">Loading account settings...</div>}>
      <AccountPageInner />
    </Suspense>
  );
}

function AccountPageInner() {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) || "profile";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useSidePanel(<PreferencesSidePanel />);

  async function loadProfile() {
    setLoading(true);
    setNotice(null);
    const response = await fetch("/api/account/profile", { cache: "no-store" });
    if (!response.ok) {
      setNotice({
        tone: "error",
        text: "アカウント情報を読み込めませんでした。再ログインしてください。",
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
        text: "メールアドレス変更コードを送信できませんでした。",
      });
      return;
    }
    setNotice({
      tone: "success",
      text: "新しいメールアドレスに確認コードを送信しました。",
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
        text: "確認コードを検証できませんでした。コードを確認してください。",
      });
      return;
    }
    setVerificationCode("");
    setNotice({ tone: "success", text: "メールアドレスを更新しました。" });
    await loadProfile();
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 sm:p-8">
      <h1 className="mb-6 text-2xl font-normal text-foreground">Account Settings</h1>

      <div className="max-w-4xl">
        {activeTab === "profile" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Profile Information</h2>
              <p className="mt-1 text-foreground-muted">
                メールアドレスとログイン方法を管理します。
              </p>
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
                  <UserRound className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold text-foreground">アカウント</h3>
                </div>
                <button
                  type="button"
                  onClick={() => void loadProfile()}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-0"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  更新
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-foreground-subtle">読み込み中...</p>
              ) : (
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-foreground-subtle">メールアドレス</dt>
                    <dd className="mt-1 font-medium text-foreground">{profile?.email ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground-subtle">メール確認</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {profile?.emailVerified ? "確認済み" : "未確認"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-foreground-subtle">Account ID</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-foreground">
                      {accountId}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="border border-border bg-surface-0 rounded-md p-6">
              <div className="mb-4 flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="font-semibold text-foreground">登録メールアドレスの変更</h3>
              </div>
              <form onSubmit={handleEmailStart} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="text-sm">
                  <span className="mb-2 block font-medium text-foreground">
                    新しいメールアドレス
                  </span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={pendingEmail}
                    onChange={(event) => setPendingEmail(event.target.value)}
                    className="w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none"
                  />
                </label>
                <button
                  type="button"
                  disabled={submitting}
                  className="self-end rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60"
                >
                  変更コードを送信
                </button>
              </form>

              <form
                onSubmit={handleEmailVerify}
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
              >
                <label className="text-sm">
                  <span className="mb-2 block font-medium text-foreground">確認コード</span>
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    className="w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none"
                  />
                </label>
                <button
                  type="button"
                  disabled={submitting}
                  className="self-end rounded-md px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface-0 disabled:opacity-60"
                >
                  コードを確認
                </button>
              </form>
            </section>

            <section className="border border-border bg-surface-0 rounded-md p-6">
              <div className="mb-4 flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="font-semibold text-foreground">ログイン方法</h3>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth/cognito/login?next=/dashboard/account"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  passkey / 外部ログインを追加・変更
                </Link>
                <Link
                  href="/auth/email"
                  className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface-0"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  メールOTPで再ログイン
                </Link>
              </div>
            </section>
          </div>
        )}

        {activeTab === "subscription" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Subscription</h2>
            <p className="text-foreground-muted">Manage your subscription plan and billing.</p>
            <SubscriptionSection />
          </div>
        )}

        {activeTab === "statistics" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Tile Statistics</h2>
            <p className="text-foreground-muted">View your tile usage and completion metrics.</p>
            <TileStatistics />
          </div>
        )}

        {activeTab === "usage" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Usage Dashboard</h2>
            <p className="text-foreground-muted">Track your activity and productivity over time.</p>
            <UsageDashboard />
          </div>
        )}

        {activeTab === "tokens" && <AccessTokenSection />}
      </div>
    </div>
  );
}
