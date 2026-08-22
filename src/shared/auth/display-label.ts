/**
 * Derive a human-readable label for the avatar / top-right user chip.
 * Order:
 *   1. Profile.display_name — set by the user explicitly.
 *   2. Email local part (`john` from `john@example.com`) — most users
 *      recognize this immediately.
 *   3. Owner_id or sub UUID prefix — last resort, content-free.
 *
 * Exposing a UUID prefix as the user-visible label is a privacy +
 * usability bug (production 2026-07-22: `6bd31b87` showed up on the
 * top-right avatar for every user without a profile row).
 */
export function pickDisplayLabel(args: {
  displayName: string | null | undefined;
  email: string | null | undefined;
  ownerId: string | null;
  sub: string;
}): string {
  const name = args.displayName?.trim();
  if (name && name.length > 0) return name;
  const localEmail = emailLocalPart(args.email);
  if (localEmail) return localEmail;
  return args.ownerId ? args.ownerId.slice(0, 8) : args.sub.slice(0, 8);
}

function emailLocalPart(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return null;
  const local = email.slice(0, at).trim();
  return local.length > 0 ? local : null;
}
