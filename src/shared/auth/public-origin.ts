import { isLoopbackUrl, isProtectedWebRuntime } from "@/shared/config/runtime-env";

function safeOrigin(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Public origin of this deployment, from NEXT_PUBLIC_APP_URL. */
export function getPublicOrigin(): string {
  const configured = safeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (configured && (!isProtectedWebRuntime() || !isLoopbackUrl(configured))) return configured;
  if (isProtectedWebRuntime()) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a public non-loopback origin in staging and production");
  }
  return "http://localhost:3000";
}
