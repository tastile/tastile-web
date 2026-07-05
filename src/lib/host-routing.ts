const ApexHost = "tastile.app";
const AppHost = "app.tastile.app";

const AppSitePrefixes = ["/app", "/auth", "/dashboard", "/login"];
const AppApiPrefixes = ["/api/account", "/api/auth", "/api/stripe"];

export function resolveCanonicalHostRedirect(host: string, pathname: string): string | null {
  const normalizedHost = host.toLowerCase().split(":")[0];
  const normalizedPath = normalizePath(pathname);

  if (normalizedHost === ApexHost && isAppPath(normalizedPath)) {
    return AppHost;
  }

  return null;
}

function normalizePath(pathname: string): string {
  if (!pathname.startsWith("/")) {
    return `/${pathname}`;
  }

  return pathname;
}

function isAppPath(pathname: string): boolean {
  return (
    AppSitePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    AppApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}
