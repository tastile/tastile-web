"use client";

import { useEffect, useState } from "react";
import {
  getSecurityLockEnabled,
  getSecurityLockTimeoutMinutes,
  SECURITY_LOCK_CREDENTIAL_ID_KEY,
  SECURITY_LOCK_LEFT_AT_KEY,
  shouldRequireSecurityUnlock,
} from "@/lib/security/security-lock-policy";

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
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
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
  if (!id) throw new Error("Credential creation failed.");
  localStorage.setItem(SECURITY_LOCK_CREDENTIAL_ID_KEY, id);
  return id;
}

async function requestPlatformUnlock() {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn is unavailable.");
  }
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!available) {
    throw new Error("Platform authenticator is unavailable.");
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
  const [state, setState] = useState<LockState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const enabled = getSecurityLockEnabled(localStorage);
    const timeoutMinutes = getSecurityLockTimeoutMinutes(localStorage);
    const lastLeftAt = Number.parseInt(localStorage.getItem(SECURITY_LOCK_LEFT_AT_KEY) ?? "0", 10);
    const needsLock = shouldRequireSecurityUnlock({
      enabled,
      timeoutMinutes,
      lastLeftAt,
      now: Date.now(),
    });
    setState(needsLock ? "locked" : "unlocked");
  }, []);

  useEffect(() => {
    const markLeft = () => {
      if (getSecurityLockEnabled(localStorage)) {
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
      setMessage(error instanceof Error ? error.message : "Unlock failed.");
      setState("unavailable");
    }
  }

  return (
    <>
      {children}
      {state !== "unlocked" && state !== "checking" ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/95 p-6 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl bg-surface-1 p-6">
            <p className="text-sm font-medium text-primary">Tastile Security</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Unlock Tastile</h2>
            <p className="mt-3 text-sm text-foreground-muted">
              Use the standard unlock method for this device to continue.
            </p>
            {message ? <p className="mt-3 text-sm text-danger">{message}</p> : null}
            <button
              type="button"
              onClick={unlock}
              className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-fg"
            >
              Unlock with this device
            </button>
            {state === "unavailable" ? (
              <button
                type="button"
                onClick={() => setState("unlocked")}
                className="mt-3 w-full rounded-full px-4 py-3 text-sm font-semibold text-foreground"
              >
                Continue
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
