function safeOrigin(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Public origin of this deployment, from NEXT_PUBLIC_APP_URL (fallback localhost). */
export function getPublicOrigin(): string {
  return safeOrigin(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";
}