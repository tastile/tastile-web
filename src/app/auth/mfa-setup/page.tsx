"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";

type SetupState =
  | { kind: "loading" }
  | { kind: "ready"; secretCode: string; otpauthUrl: string }
  | { kind: "error"; message: string }
  | { kind: "submitting" }
  | { kind: "done" };

export default function MfaSetupPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <p className="text-foreground-muted">読み込み中…</p>
        </main>
      }
    >
      <MfaSetupInner />
    </Suspense>
  );
}

function MfaSetupInner() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const router = useRouter();
  const email = params.get("email") ?? "";
  const [state, setState] = useState<SetupState>({ kind: "loading" });
  const [code, setCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/mfa/setup", { method: "POST" });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? "setup_failed");
        }
        const json = await res.json();
        if (!cancelled) {
          setState({
            kind: "ready",
            secretCode: json.secretCode,
            otpauthUrl: json.otpauthUrl,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "unknown",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitCode() {
    if (!/^[0-9]{6}$/.test(code)) return;
    setState({ kind: "submitting" });
    try {
      const form = new FormData();
      form.set("code", code);
      const res = await fetch("/api/account/mfa/verify", {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          setState({ kind: "done" });
          router.replace("/dashboard");
          return;
        }
      }
      if (res.status === 401) {
        setState({ kind: "error", message: t("auth.mfaSetup.codeMismatch") });
        return;
      }
      const json = await res.json().catch(() => ({ error: "verify_failed" }));
      setState({
        kind: "error",
        message: json.error ?? "verify_failed",
      });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "unknown",
      });
    }
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
