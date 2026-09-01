"use client";

import { PreferencesSidePanel } from "@/features/manage-settings/ui/PreferencesSidePanel";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { useTranslation } from "@/shared/i18n/use-translation";
import { AccessTokenSection } from "@/shared/ui/AccessTokenSection";
import { SubscriptionSection } from "@/shared/ui/SubscriptionSection";
import { Alert, Button, Modal, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  AlertCircle,
  Edit,
  Mail,
  MailIcon,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type TabId = "profile" | "subscription" | "tokens";

type Profile = {
  username: string;
  sub: string | null;
  email: string | null;
  emailVerified: boolean;
  preferredUsername: string | null;
};

type Notice = { tone: "success" | "error"; text: string } | null;

export default function AccountSettings() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-foreground-subtle">
          {t("preferences.account.loadingFallback")}
        </div>
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

  const sidePanel = useMemo(
    () => (
      <Suspense>
        <PreferencesSidePanel />
      </Suspense>
    ),
    [],
  );
  useSidePanel(sidePanel);

  const loadProfile = useCallback(() => {
    return fetch("/api/account/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          setNotice({
            tone: "error",
            text: t("preferences.account.notice.loadFailed"),
          });
        } else {
          const body = (await response.json()) as { profile: Profile };
          setProfile(body.profile);
          setPendingEmail(body.profile.email ?? "");
        }
      })
      .catch(() => {
        setNotice({
          tone: "error",
          text: t("preferences.account.notice.loadFailed"),
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const accountId = useMemo(
    () => profile?.sub ?? profile?.username ?? "-",
    [profile],
  );
  const [isEmailModalOpen, { open: openEmailModal, close: closeEmailModal }] =
    useDisclosure(false);

  function handleEmailStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    fetch("/api/account/email/start", {
      method: "POST",
      body: form,
    })
      .then(async (response) => {
        if (!response.ok) {
          setNotice({
            tone: "error",
            text: t("preferences.account.notice.emailStartFailed"),
          });
        } else {
          setNotice({
            tone: "success",
            text: t("preferences.account.notice.emailStartSent"),
          });
        }
      })
      .catch(() => {
        setNotice({
          tone: "error",
          text: t("preferences.account.notice.emailStartFailed"),
        });
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  function handleEmailVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    fetch("/api/account/email/verify", {
      method: "POST",
      body: form,
    })
      .then(async (response) => {
        if (!response.ok) {
          setNotice({
            tone: "error",
            text: t("preferences.account.notice.emailVerifyFailed"),
          });
        } else {
          setVerificationCode("");
          setNotice({
            tone: "success",
            text: t("preferences.account.notice.emailUpdated"),
          });
          await loadProfile();
        }
      })
      .catch(() => {
        setNotice({
          tone: "error",
          text: t("preferences.account.notice.emailVerifyFailed"),
        });
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 sm:p-8">
      <h1 className="text-2xl font-normal text-foreground">
        {t("preferences.account.title")}
      </h1>

      <div className="max-w-4xl">
        {activeTab === "profile" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {t("preferences.account.profileHeading")}
              </h2>
              <p className="mt-1 text-foreground-muted">
                {t("preferences.account.profileGuide")}
              </p>
            </div>

            {notice && (
              <Alert
                className={`rounded-md px-4 py-3 text-sm ${
                  notice.tone === "success"
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
                color="red"
                title={notice.text}
                icon={<AlertCircle className="size-4" />}
              />
            )}

            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <UserRound
                    className="size-5 text-foreground-muted"
                    aria-hidden="true"
                  />
                  <h3 className="font-semibold text-foreground">
                    {t("preferences.account.accountHeading")}
                  </h3>
                </div>
                <Button
                  component="button"
                  radius="xl"
                  size="xs"
                  variant="subtle"
                  className="bg-surface-3 text-foreground hover:bg-surface-2"
                  title={t("preferences.account.refresh")}
                  aria-label={t("preferences.account.refresh")}
                  onClick={() => void loadProfile()}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                </Button>
              </div>

              {loading ? (
                <p className="text-sm text-foreground-subtle">
                  {t("preferences.account.loading")}
                </p>
              ) : (
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-foreground-subtle">
                        {t("preferences.account.email")}
                      </dt>
                      <Button
                        onClick={openEmailModal}
                        variant="subtle"
                        aria-label={t("preferences.account.email")}
                      >
                        <Edit className="size-4" aria-hidden="true" />
                      </Button>
                    </div>

                    <dd className="mt-1 font-medium text-foreground">
                      {profile?.email ?? "-"}
                    </dd>
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
                    <dt className="text-foreground-subtle">
                      {t("preferences.account.accountId")}
                    </dt>
                    <dd className="mt-1 break-all font-mono text-xs text-foreground">
                      {accountId}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <Modal
              opened={isEmailModalOpen}
              onClose={closeEmailModal}
              title={t("preferences.account.changeEmailHeading")}
            >
              <div className="mb-4 flex items-center gap-3">
                <Mail
                  className="size-5 text-foreground-muted"
                  aria-hidden="true"
                />
                <h3 className="font-semibold text-foreground">
                  {t("preferences.account.changeEmailHeading")}
                </h3>
              </div>
              <form
                onSubmit={handleEmailStart}
                className="grid gap-3 sm:grid-cols-[1fr_auto]"
              >
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="preferences-account-new-email"
                    className="text-sm font-medium text-foreground"
                  >
                    {t("preferences.account.newEmail")}
                  </label>
                  <TextInput
                    id="preferences-account-new-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={pendingEmail}
                    rightSection={
                      <MailIcon className="size-4 text-foreground-subtle" />
                    }
                    onChange={(event) => setPendingEmail(event.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="self-end rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60"
                >
                  {t("preferences.account.sendCode")}
                </Button>
              </form>

              <form
                onSubmit={handleEmailVerify}
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
              >
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="preferences-account-verify-code"
                    className="text-sm font-medium text-foreground"
                  >
                    {t("preferences.account.code")}
                  </label>
                  <TextInput
                    id="preferences-account-verify-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    required
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(event.currentTarget.value)
                    }
                  />
                </div>
                <Button type="submit" disabled={submitting}>
                  {t("preferences.account.verifyCode")}
                </Button>
              </form>
            </Modal>
          </div>
        )}

        {activeTab === "subscription" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              {t("preferences.account.subscriptionHeading")}
            </h2>
            <p className="text-foreground-muted">
              {t("preferences.account.subscriptionGuide")}
            </p>
            <SubscriptionSection />
          </div>
        )}

        {activeTab === "tokens" && <AccessTokenSection />}
      </div>
    </div>
  );
}
