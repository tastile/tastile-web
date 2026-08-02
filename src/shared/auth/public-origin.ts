function safeOrigin(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getCognitoPublicOrigin(callbackUrl?: string): string {
  return (
    safeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    safeOrigin(callbackUrl) ??
    "http://localhost:3000"
  );
}
