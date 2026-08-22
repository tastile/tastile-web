// Cookie name + attributes shared by the server-side reader and the
// client-side switcher. Kept in a leaf module (no `next/headers` import)
// so the client bundle can import it without pulling server-only APIs.

export const LOCALE_COOKIE = "NEXT_LOCALE" as const;

// One year is the upper bound Next.js docs recommend for `NEXT_LOCALE`-style
// cookies; long enough that a returning visitor keeps their choice, short
// enough that an abandoned device eventually reverts to Accept-Language.
const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function localeCookieAttributes(): string {
  return `path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

