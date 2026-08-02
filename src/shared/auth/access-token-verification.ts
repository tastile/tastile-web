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
    console.warn(
      "[auth] verifyCognitoAccessToken: env validation failed —",
      `issuer expected=${expectedIssuer} got=${env.issuer},`,
      `hostedUiBaseUrl expected=${expectedHostedUiBaseUrl} got=${env.hostedUiBaseUrl}`,
    );
    return null;
  }

  try {
    const response = await fetchImpl(`${env.hostedUiBaseUrl}/oauth2/userInfo`, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(
        `[auth] verifyCognitoAccessToken: /oauth2/userInfo returned ${response.status}`,
        `(token length=${accessToken.length})`,
      );
      return null;
    }

    const body = (await response.json()) as { sub?: unknown };
    if (typeof body.sub !== "string" || body.sub.length === 0) {
      console.warn("[auth] verifyCognitoAccessToken: userInfo response has no valid sub");
      return null;
    }
    return body.sub;
  } catch (err) {
    console.warn("[auth] verifyCognitoAccessToken: fetch error —", err);
    return null;
  }
}
