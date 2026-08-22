"use client";

import {
  SECURITY_LOCK_CREDENTIAL_ID_KEY,
  SECURITY_LOCK_LEFT_AT_KEY,
  getEnabled,
  getTimeoutMinutes,
  shouldRequireUnlock,
} from "@/lib/security/security-lock-policy";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Button } from "@mantine/core";
import { useEffect, useState } from "react";

type LockState = "checking" | "unlocked" | "locked" | "unavailable";

const encoder = new TextEncoder();

function base64UrlToBytes(value: string) {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function ensureCredentialId() {
  const existing = localStorage.getItem(SECURITY_LOCK_CREDENTIAL_ID_KEY);
  if (existing) return existing;

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: "Tastile" },
      user: {
        id: encoder.encode("local-security-lock"),
        name: "Tastile local security lock",
        displayName: "Tastile local security lock",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256 (WebAuthn default)
        { type: "public-key", alg: -257 }, // RS256 (WebAuthn default)
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  });

  const id = credential?.id;
  if (!id) throw new Error("securityLock.errors.credential");
  localStorage.setItem(SECURITY_LOCK_CREDENTIAL_ID_KEY, id);
  return id;
}

async function requestPlatformUnlock() {
  if (!window.PublicKeyCredential) {
    throw new Error("securityLock.errors.webauthn");
  }
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!available) {
    throw new Error("securityLock.errors.platform");
  }

  const credentialId = await ensureCredentialId();
  await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [
        {
          id: base64UrlToBytes(credentialId),
          type: "public-key",
          transports: ["internal"],
        },
      ],
      userVerification: "required",
      timeout: 60_000,
    },
  });
}

export function SecurityLockGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  // Resolve the lock state from localStorage lazily so the first render
  // already reflects whether the lock is required — no effect, no extra
  // render. SSR falls back to "checking" because localStorage is unavailable
  // on the server; the client picks up the real value on hydration.
  const [state, setState] = useState<LockState>(() => {
    if (typeof window === "undefined") return "checking";
    const enabled = getEnabled(localStorage);
    const timeoutMinutes = getTimeoutMinutes(localStorage);
    const lastLeftAt = Number.parseInt(localStorage.getItem(SECURITY_LOCK_LEFT_AT_KEY) ?? "0", 10);
    const needsLock = shouldRequireUnlock({
      enabled,
      timeoutMinutes,
      lastLeftAt,
      now: Date.now(),
    });
    return needsLock ? "locked" : "unlocked";
  });
  const [message, setMessage] = useState("");

  // Map an internal error key thrown by `requestPlatformUnlock` to a
  // translated message. The thrown errors use the dotted key path so
  // the message survives translation lookup; if the translation is
  // missing we fall back to the raw key so the user still sees the cause.
  const translateError = (raw: string): string => {
    if (raw.startsWith("securityLock.errors.")) {
      const translated = t(raw);
      if (translated) return translated;
    }
    return t("securityLock.errors.unlockFailed");
  };

  useEffect(() => {
    const markLeft = () => {
      if (getEnabled(localStorage)) {
        localStorage.setItem(SECURITY_LOCK_LEFT_AT_KEY, String(Date.now()));
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") markLeft();
    };

    window.addEventListener("pagehide", markLeft);
    window.addEventListener("beforeunload", markLeft);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", markLeft);
      window.removeEventListener("beforeunload", markLeft);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  async function unlock() {
    try {
      setMessage("");
      await requestPlatformUnlock();
      localStorage.setItem(SECURITY_LOCK_LEFT_AT_KEY, String(Date.now()));
      setState("unlocked");
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      setMessage(translateError(raw));
      setState("unavailable");
    }
  }

  return (
    <>
      {children}
      {state !== "unlocked" && state !== "checking" ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/95 p-6 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl bg-surface-1 p-6">
            <p className="text-sm font-medium text-primary">{t("securityLock.heading")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">{t("securityLock.title")}</h2>
            <p className="mt-3 text-sm text-foreground-muted">
              {t("securityLock.subtitle")}
            </p>
            {message ? <p className="mt-3 text-sm text-danger">{message}</p> : null}
            <Button
              type="button"
              onClick={unlock}
              className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-fg"
              variant="subtle"
              size="compact-sm"
            >
              {t("securityLock.unlockAction")}
            </Button>
            {state === "unavailable" ? (
              <Button
                type="button"
                onClick={() => setState("unlocked")}
                className="mt-3 w-full rounded-full px-4 py-3 text-sm font-semibold text-foreground"
                variant="subtle"
                size="compact-sm"
              >
                {t("securityLock.continueAction")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
