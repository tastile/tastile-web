const LOCAL_ENVIRONMENTS = new Set(["", "development", "dev", "test", "ci", "local"]);

export function isProtectedWebRuntime(): boolean {
  const environment = (process.env.TASTILE_ENV ?? "").trim().toLowerCase();
  return !LOCAL_ENVIRONMENTS.has(environment);
}

/** Local-only auth bypass. Staging and production always use real auth. */
export function isE2EBypassEnabled(): boolean {
  return !isProtectedWebRuntime() && process.env.E2E_BYPASS_AUTH === "1";
}

export function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}
