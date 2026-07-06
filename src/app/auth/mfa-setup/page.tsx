"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "setup_failed");
        }
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
        setState({ kind: "error", message: "コードが違います" });
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
        <p className="text-foreground">エラー: {state.message}</p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          onClick={() => router.push("/auth/email")}
        >
          サインインをやり直す
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">2 段階認証のセットアップ</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          {email} のアカウントで認証アプリ (Google Authenticator、1Password、Authy など) による TOTP
          認証を有効化します。
        </p>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
        <li>認証アプリを開きます。</li>
        <li>次のシークレットを Base32 文字列として登録するか、otpauth URL を貼り付けます。</li>
        <li>6 桁コードを入力して「検証」を押します。</li>
      </ol>
      <div className="space-y-2 rounded-md bg-surface-0 p-4">
        <p className="text-xs uppercase tracking-wide text-foreground-muted">Secret (Base32)</p>
        <pre
          data-testid="secret"
          className="break-all rounded bg-surface-2 p-3 font-mono text-sm text-foreground"
        >
          {state.secretCode}
        </pre>
        <p className="text-xs text-foreground-muted">otpauth URL:</p>
        <p className="break-all font-mono text-xs text-foreground-muted">{state.otpauthUrl}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="code" className="text-sm font-medium text-foreground">
          6 桁コード
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
        検証
      </button>
    </main>
  );
}
