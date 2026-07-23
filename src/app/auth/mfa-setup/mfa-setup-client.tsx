"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";

type SetupState =
  | { kind: "loading" }
  | { kind: "ready"; secretCode: string; otpauthUrl: string }
  | { kind: "error"; message: string }
  | { kind: "submitting" }
  | { kind: "done" };

// Explicit response shapes for the two POSTs the page owns. No `any`.
type SetupSuccess = { secretCode: string; otpauthUrl: string };
type SetupErrorBody = { error?: string };
type VerifySuccess = { ok: true };
type VerifyErrorBody = { ok?: boolean; error?: string; message?: string };

function errorMessageFrom(parsed: unknown, fallback: string): string {
  if (
    parsed &&
    typeof parsed === "object" &&
    "error" in parsed &&
    typeof (parsed as { error: unknown }).error === "string"
  ) {
    return (parsed as { error: string }).error;
  }
  return fallback;
}

export function MfaSetupClient({ email }: { email: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<SetupState>({ kind: "loading" });
  const [code, setCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let res: Response;
      try {
        res = await fetch("/api/account/mfa/setup", {
          method: "POST",
          credentials: "same-origin",
        });
      } catch (error) {
        // Network / abort only — HTTP error path lives below as a state
        // branch so the React-Doctor explicit-throw rule stays happy.
        if (!cancelled) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "unknown",
          });
        }
        return;
      }
      if (cancelled) return;
      // Status guard first; only then read the body. React-Doctor
      // `no-fetch-response-used-without-status-check` requires the textual
      // `!res.ok` branch to be in place before any `.json()` call so a failed
      // response cannot trigger a body parse that would then throw.
      if (!res.ok) {
        const parsed = (await res
          .json()
          .catch(() => null)) as SetupErrorBody | null;
        setState({
          kind: "error",
          message: errorMessageFrom(parsed, "setup_failed"),
        });
        return;
      }
      const parsed = (await res
        .json()
        .catch(() => null)) as SetupSuccess | null;
      if (
        !parsed ||
        typeof (parsed as SetupSuccess).secretCode !== "string" ||
        typeof (parsed as SetupSuccess).otpauthUrl !== "string"
      ) {
        // 2xx but the body is unusable — fall back to the stable error.
        setState({ kind: "error", message: "setup_failed" });
        return;
      }
      setState({
        kind: "ready",
        secretCode: (parsed as SetupSuccess).secretCode,
        otpauthUrl: (parsed as SetupSuccess).otpauthUrl,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitCode() {
    if (!/^[0-9]{6}$/.test(code)) return;
    setState({ kind: "submitting" });
    let res: Response;
    try {
      const form = new FormData();
      form.set("code", code);
      res = await fetch("/api/account/mfa/verify", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "unknown",
      });
      return;
    }
    // Status guards first; only then read the body. The 401 branch must run
    // before any `.json()` so the translated "code mismatch" copy wins and
    // the response body stays untouched. The remaining branches then read the
    // body exactly once each.
    if (res.status === 401) {
      setState({ kind: "error", message: t("auth.mfaSetup.codeMismatch") });
      return;
    }
    if (!res.ok) {
      const parsed = (await res
        .json()
        .catch(() => null)) as VerifyErrorBody | null;
      setState({
        kind: "error",
        message: errorMessageFrom(parsed, "verify_failed"),
      });
      return;
    }
    const parsed = (await res
      .json()
      .catch(() => null)) as VerifySuccess | VerifyErrorBody | null;
    if (parsed && parsed.ok === true) {
      setState({ kind: "done" });
      router.replace("/dashboard");
      return;
    }
    setState({
      kind: "error",
      message: errorMessageFrom(parsed, "verify_failed"),
    });
  }

  if (state.kind === "loading" || state.kind === "submitting") {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-foreground-muted">読み込み中…</p>
      </main>
    );
  }
  if (state.kind === "done") {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-foreground">OK</p>
      </main>
    );
  }
  if (state.kind === "error") {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <p className="text-foreground">
          {t("auth.mfaSetup.errorPrefix")} {state.message}
        </p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          onClick={() => router.push("/auth/email")}
        >
          {t("auth.mfaSetup.retrySignin")}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("auth.mfaSetup.title")}</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("auth.mfaSetup.guidePrefix")} <span className="font-mono">{email}</span>{" "}
          {t("auth.mfaSetup.guideSuffix")}
        </p>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
        <li>{t("auth.mfaSetup.step1")}</li>
        <li>{t("auth.mfaSetup.step2")}</li>
        <li>{t("auth.mfaSetup.step3")}</li>
      </ol>
      <div className="space-y-2 rounded-md bg-surface-0 p-4">
        <p className="text-xs uppercase tracking-wide text-foreground-muted">
          {t("auth.mfaSetup.secretLabel")}
        </p>
        <pre
          data-testid="secret"
          className="break-all rounded bg-surface-2 p-3 font-mono text-sm text-foreground"
        >
          {state.secretCode}
        </pre>
        <p className="text-xs text-foreground-muted">{t("auth.mfaSetup.otpauthLabel")}</p>
        <p className="break-all font-mono text-xs text-foreground-muted">{state.otpauthUrl}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="code" className="text-sm font-medium text-foreground">
          {t("auth.mfaSetup.codeLabel")}
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          inputMode="numeric"
          pattern="[0-9]{6}"
          autoComplete="one-time-code"
          required
          className="w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <button
        type="button"
        onClick={submitCode}
        disabled={!/^[0-9]{6}$/.test(code)}
        className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50"
      >
        {t("auth.mfaSetup.verify")}
      </button>
    </main>
  );
}
