"use client";

import { Check, Copy, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";

type ApiToken = {
  token_id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  last_used_path: string | null;
  revoked_at: string | null;
};

type CreatedToken = ApiToken & {
  access_token: string;
};

export function AccessTokenSection() {
  const { t, locale } = useTranslation();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [name, setName] = useState("");
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/account/tokens", { cache: "no-store" });
      if (!response.ok) throw new Error(t("account.tokens.error.loadFailed"));
      setTokens((await response.json()) as ApiToken[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.tokens.error.loadFallback"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  async function createToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreatedToken(null);
    try {
      const response = await fetch("/api/account/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(t("account.tokens.error.createFailed"));
      const created = (await response.json()) as CreatedToken;
      setCreatedToken(created);
      setName("");
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.tokens.error.createFallback"));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveName(tokenId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/account/tokens/${tokenId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      if (!response.ok) throw new Error(t("account.tokens.error.updateFailed"));
      setEditingId(null);
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.tokens.error.updateFallback"));
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeToken(tokenId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/account/tokens/${tokenId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(t("account.tokens.error.revokeFailed"));
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.tokens.error.revokeFallback"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyToken(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("account.tokens.heading")}</h2>
        <p className="mt-1 text-foreground-muted">{t("account.tokens.description")}</p>
      </div>

      {error ? (
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      {createdToken ? (
        <section className="rounded-md bg-success/10 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">{t("account.tokens.newTokenHeading")}</h3>
            <button
              type="button"
              onClick={() => void copyToken(createdToken.access_token)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("account.tokens.copied") : t("account.tokens.copy")}
            </button>
          </div>
          <code className="block break-all rounded-md border border-border bg-surface-0 p-3 font-mono text-xs text-foreground">
            {createdToken.access_token}
          </code>
        </section>
      ) : null}

      <form onSubmit={createToken} className="border border-border bg-surface-0 rounded-md p-5">
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-foreground">
            {t("account.tokens.nameLabel")}
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className="w-full rounded-md border border-border bg-surface-0 px-3 py-3 text-foreground outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {t("account.tokens.issue")}
        </button>
      </form>

      <section className="border border-border bg-surface-0 rounded-md p-5">
        <div className="mb-4 flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-foreground-muted" />
          <h3 className="font-semibold text-foreground">{t("account.tokens.issuedHeading")}</h3>
        </div>

        {loading ? <p className="text-sm text-foreground-subtle">{t("common.loading")}</p> : null}

        {!loading && tokens.length === 0 ? (
          <p className="text-sm text-foreground-muted">{t("account.tokens.empty")}</p>
        ) : null}

        <div className="space-y-3">
          {tokens.map((token) => {
            const revoked = Boolean(token.revoked_at);
            const editing = editingId === token.token_id;
            return (
              <div
                key={token.token_id}
                className="rounded-md border border-border bg-surface-0 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <div className="flex gap-2">
                        <input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          maxLength={80}
                          className="min-w-0 flex-1 rounded-md border border-border bg-surface-0 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => void saveName(token.token_id)}
                          disabled={submitting || !editingName.trim()}
                          className="rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-fg disabled:opacity-60"
                        >
                          {t("common.save")}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{token.name}</p>
                        {revoked ? (
                          <span className="rounded bg-danger/10 px-2 py-0.5 text-xs text-danger">
                            {t("account.tokens.revoked")}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <p className="mt-1 break-all font-mono text-xs text-foreground-subtle">
                      {token.token_prefix}...
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(token.token_id);
                        setEditingName(token.name);
                      }}
                      disabled={revoked}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-40"
                    >
                      <Pencil className="h-4 w-4" />
                      {t("account.tokens.rename")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void revokeToken(token.token_id)}
                      disabled={revoked || submitting}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("account.tokens.revoke")}
                    </button>
                  </div>
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <Meta
                    label={t("account.tokens.meta.createdAt")}
                    value={formatDate(token.created_at, locale)}
                  />
                  <Meta
                    label={t("account.tokens.meta.lastUsed")}
                    value={formatDate(token.last_used_at, locale)}
                  />
                  <Meta
                    label={t("account.tokens.meta.lastUsedPath")}
                    value={token.last_used_path ?? "-"}
                    mono
                  />
                </dl>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className={`mt-1 break-all text-foreground ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString(locale === "ja" ? "ja-JP" : "en-US", { timeZone: "UTC" });
}
