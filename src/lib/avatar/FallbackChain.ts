/**
 * FallbackChain.ts — Avatar display fallback (v1/15 §3).
 *
 * Chain: profile.avatar_url → Gravatar(email) → initials(display_name)
 *
 * Phase A: skeleton. Full implementation in Phase X.
 */

export function getAvatarUrl(
  avatarUrl: string | null | undefined,
  email: string | null | undefined,
  displayName: string | null | undefined
): string {
  if (avatarUrl) return avatarUrl;

  if (email) {
    // Gravatar fallback (MD5 hash of lowercase trimmed email)
    // TODO: implement MD5 hash
    // return `https://www.gravatar.com/avatar/${md5(email.trim().toLowerCase())}?d=identicon`;
  }

  // Initials fallback — return empty string; caller renders initials overlay
  return "";
}

export function getInitials(displayName: string | null | undefined): string {
  if (!displayName) return "?";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}
