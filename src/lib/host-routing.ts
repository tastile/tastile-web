const ApexHost = "tastile.app";
const AppHost = "app.tastile.app";

const PublicSitePaths = ["/", "/pricing", "/download", "/privacy", "/terms"];
const AppSitePrefixes = ["/app", "/auth", "/dashboard", "/login"];
const AppApiPrefixes = ["/api/account", "/api/auth", "/api/stripe"];

export function resolveCanonicalHostRedirect(host: string, pathname: string): string | null {
  const normalizedHost = host.toLowerCase().split(":")[0];
  const normalizedPath = normalizePath(pathname);

  if (normalizedHost === ApexHost && isAppPath(normalizedPath)) {
    return AppHost;
  }

  if (normalizedHost === AppHost && isPublicSitePath(normalizedPath)) {
    return ApexHost;
  }

  return null;
}

function normalizePath(pathname: string): string {
  if (!pathname.startsWith("/")) {
    return `/${pathname}`;
  }

  return pathname;
}

function isPublicSitePath(pathname: string): boolean {
  return PublicSitePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAppPath(pathname: string): boolean {
  return (
    AppSitePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    AppApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}
