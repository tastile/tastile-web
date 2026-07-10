import type { CognitoEnv } from "./env";

export async function verifyCognitoAccessToken({
  accessToken,
  env,
  fetchImpl = fetch,
}: {
  accessToken: string;
  env: CognitoEnv;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const expectedIssuer = `https://cognito-idp.${env.region}.amazonaws.com/${env.userPoolId}`;
  const expectedHostedUiBaseUrl = `https://${env.hostedUiDomain}.auth.${env.region}.amazoncognito.com`;
  if (
    env.issuer.replace(/\/+$/, "") !== expectedIssuer ||
    env.hostedUiBaseUrl.replace(/\/+$/, "") !== expectedHostedUiBaseUrl
  ) {
    return null;
  }

  try {
    const response = await fetchImpl(`${env.hostedUiBaseUrl}/oauth2/userInfo`, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { sub?: unknown };
    return typeof body.sub === "string" && body.sub.length > 0 ? body.sub : null;
  } catch {
    return null;
  }
}
