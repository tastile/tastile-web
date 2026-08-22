// Open-redirect guard for post-auth navigation targets.
// Extracted from the former login-url.ts (Cognito OAuth helpers removed in
// ADR 2026-08-22).

export function safeNextPath(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
