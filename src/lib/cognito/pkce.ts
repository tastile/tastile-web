// S256 PKCE pair generation. Browser Web Crypto only — no Node deps.

export async function generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const codeVerifier = base64UrlEncode(bytes)

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  const codeChallenge = base64UrlEncode(new Uint8Array(digest))

  return { codeVerifier, codeChallenge }
}

export function generateState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i])
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
