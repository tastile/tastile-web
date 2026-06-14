export function getCognitoPublicOrigin(callbackUrl?: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) return new URL(appUrl).origin
  if (callbackUrl) return new URL(callbackUrl).origin
  return 'http://localhost:3000'
}

