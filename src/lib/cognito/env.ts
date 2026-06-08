export interface CognitoEnv {
  userPoolId: string
  clientId: string
  hostedUiDomain: string
  issuer: string
  jwksUrl: string
  hostedUiBaseUrl: string
  region: string
  callbackUrl: string
  logoutUrl: string
}

export function tryGetCognitoEnv(): CognitoEnv | null {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim()
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim()
  const hostedUiDomain = process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN?.trim()
  const issuer = process.env.NEXT_PUBLIC_COGNITO_ISSUER?.trim()
  const jwksUrl = process.env.NEXT_PUBLIC_COGNITO_JWKS_URL?.trim()
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION?.trim()
  const callbackUrl = process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL?.trim()
  const logoutUrl = process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URL?.trim()

  if (!userPoolId || !clientId || !hostedUiDomain || !issuer || !jwksUrl || !region || !callbackUrl || !logoutUrl) {
    return null
  }

  return {
    userPoolId,
    clientId,
    hostedUiDomain,
    issuer,
    jwksUrl,
    region,
    callbackUrl,
    logoutUrl,
    hostedUiBaseUrl: `https://${hostedUiDomain}.auth.${region}.amazoncognito.com`,
  }
}
