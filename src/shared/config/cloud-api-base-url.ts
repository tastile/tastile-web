import { isLoopbackUrl } from "./runtime-env";

class InvalidCloudApiBaseError extends Error {
  constructor(value: string, reason: string) {
    super(`Core API base URL ${reason}: ${value}`);
    this.name = "InvalidCloudApiBaseError";
  }
}

/** Validate an absolute HTTPS URL, allowing loopback HTTP only by explicit policy. */
export function validateCloudApiBase(
  value: string,
  options: { allowLoopbackHttp: boolean },
): string {
  const candidate = value.trim();
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new InvalidCloudApiBaseError(candidate, "must be an absolute URL");
  }

  const loopback = isLoopbackUrl(candidate);
  if (loopback && !options.allowLoopbackHttp) {
    throw new InvalidCloudApiBaseError(
      candidate,
      "must not point to a loopback address in a protected runtime",
    );
  }
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && loopback && options.allowLoopbackHttp)
  ) {
    throw new InvalidCloudApiBaseError(
      candidate,
      "must use HTTPS except for local loopback development URLs",
    );
  }
  return candidate.replace(/\/$/, "");
}

/** Resolve and validate public browser-side Core URL aliases before direct fetches. */
export function resolvePublicCloudApiBaseUrl(override?: string): string {
  const value =
    override?.trim() ||
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL?.trim() ||
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL?.trim() ||
    "";
  if (!value) return "";

  // NODE_ENV is statically available to browser bundles. A production build
  // never permits HTTP, even if a server-only TASTILE_ENV is not inlined.
  return validateCloudApiBase(value, {
    allowLoopbackHttp: process.env.NODE_ENV !== "production",
  });
}
