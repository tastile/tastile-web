"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { Alert, Button, Modal, TextInput } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  const clipboard = useClipboard({ timeout: 2000 });
  const [creating, setCreating] = useState(false);

  const loadTokens = useCallback(() => {
    return fetch("/api/account/tokens", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          setError(t("account.tokens.error.loadFailed"));
          return;
        }
        setTokens((await response.json()) as ApiToken[]);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : t("account.tokens.error.loadFallback"),
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  function createToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreatedToken(null);
    void fetch("/api/account/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then(async (response) => {
        if (!response.ok) {
          setError(t("account.tokens.error.createFailed"));
          return;
        }
        const created = (await response.json()) as CreatedToken;
        setCreatedToken(created);
        setName("");
        setCreating(false);
        await loadTokens();
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : t("account.tokens.error.createFallback"),
        );
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  function saveName(tokenId: string) {
    setSubmitting(true);
    setError(null);
    void fetch(`/api/account/tokens/${tokenId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: editingName }),
    })
      .then(async (response) => {
        if (!response.ok) {
          setError(t("account.tokens.error.updateFailed"));
          return;
        }
        setEditingId(null);
        await loadTokens();
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : t("account.tokens.error.updateFallback"),
        );
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  function revokeToken(tokenId: string) {
    setSubmitting(true);
    setError(null);
    void fetch(`/api/account/tokens/${tokenId}`, { method: "DELETE" })
      .then(async (response) => {
        if (!response.ok) {
          setError(t("account.tokens.error.revokeFailed"));
          return;
        }
        await loadTokens();
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : t("account.tokens.error.revokeFallback"),
        );
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  const copyToken = (value: string) => {
    clipboard.copy(value);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("account.tokens.heading")}
        </h2>
        <p className="mt-1 text-foreground-muted">
          {t("account.tokens.description")}
        </p>
      </div>

      {error ? (
        <Alert
          title={error}
          icon={<AlertCircle className="size-4" />}
          color="red"
        />
      ) : null}

      {createdToken ? (
        <section className="rounded-md bg-success/10 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">
              {t("account.tokens.newTokenHeading")}
            </h3>
            <Button
              component="button"
              onClick={() => void copyToken(createdToken.access_token)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              {clipboard.copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {clipboard.copied
                ? t("account.tokens.copied")
                : t("account.tokens.copy")}
            </Button>
          </div>
          <code className="block break-all rounded-md border border-border bg-surface-0 p-3 font-mono text-xs text-foreground">
            {createdToken.access_token}
          </code>
        </section>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          component="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          <Plus className="size-4" />
          {t("account.tokens.issue")}
        </Button>
      </div>

      <Modal
        opened={creating}
        onClose={() => {
          setCreating(false);
          setName("");
        }}
        title={t("account.tokens.nameLabel")}
        centered
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createToken(e);
          }}
          className="space-y-4"
        >
          <TextInput
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={80}
            label={t("account.tokens.nameLabel")}
            placeholder={t("account.tokens.namePlaceholder")}
            required
            data-autofocus
          />
          <div className="flex justify-end gap-2">
            <Button
              component="button"
              type="button"
              variant="default"
              onClick={() => {
                setCreating(false);
                setName("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              component="button"
              type="submit"
              disabled={submitting || !name.trim()}
            >
              {t("account.tokens.issue")}
            </Button>
          </div>
        </form>
      </Modal>

      <section className="border border-border bg-surface-0 rounded-md p-5">
        <div className="mb-4 flex items-center gap-3">
          <KeyRound className="size-5 text-foreground-muted" />
          <h3 className="font-semibold text-foreground">
            {t("account.tokens.issuedHeading")}
          </h3>
        </div>

        {loading ? (
          <p className="text-sm text-foreground-subtle">
            {t("common.loading")}
          </p>
        ) : null}

        {!loading && tokens.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            {t("account.tokens.empty")}
          </p>
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
                          name="token-name"
                          autoComplete="off"
                          value={editingName}
                          onChange={(event) =>
                            setEditingName(event.target.value)
                          }
                          maxLength={80}
                          aria-label={t("account.tokens.nameLabel")}
                          className="min-w-0 flex-1 rounded-md border border-border bg-surface-0 px-3 py-2 text-input text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                        />
                        <Button
                          component="button"
                          onClick={() => void saveName(token.token_id)}
                          disabled={submitting || !editingName.trim()}
                        >
                          {t("common.save")}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {token.name}
                        </p>
                        {revoked ? (
                          <span className="rounded bg-danger/10 px-2 py-0.5 text-xs text-danger">
                            {t("account.tokens.revoked")}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <p className="mt-1 break-all font-mono text-xs text-foreground-subtle">
                      {token.token_prefix}…
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      component="button"
                      onClick={() => {
                        setEditingId(token.token_id);
                        setEditingName(token.name);
                      }}
                      disabled={revoked}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-40"
                    >
                      <Pencil className="size-4" />
                      {t("account.tokens.rename")}
                    </Button>
                    <Button
                      component="button"
                      onClick={() => void revokeToken(token.token_id)}
                      disabled={revoked || submitting}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-40"
                    >
                      <Trash2 className="size-4" />
                      {t("account.tokens.revoke")}
                    </Button>
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

function Meta({
  label,
  value,
  mono = false,
}: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-foreground-subtle">{label}</dt>
      <dd
        className={`mt-1 break-all text-foreground ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString(locale === "ja" ? "ja-JP" : "en-US", {
    timeZone: "UTC",
  });
}
