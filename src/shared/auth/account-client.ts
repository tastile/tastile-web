import type { CognitoEnv } from "./env";

type CognitoJson = Record<string, unknown>;

class CognitoAccountError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export async function updateCognitoUserEmail(
  env: CognitoEnv,
  accessToken: string,
  email: string,
): Promise<void> {
  await cognitoRequest(env, "UpdateUserAttributes", {
    AccessToken: accessToken,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

export async function verifyCognitoUserEmail(
  env: CognitoEnv,
  accessToken: string,
  code: string,
): Promise<void> {
  await cognitoRequest(env, "VerifyUserAttribute", {
    AccessToken: accessToken,
    AttributeName: "email",
    Code: code,
  });
}

async function cognitoRequest(
  env: CognitoEnv,
  target: string,
  body: CognitoJson,
): Promise<CognitoJson> {
  const response = await fetch(`https://cognito-idp.${env.region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  // fetch resolves on HTTP 4xx/5xx — check status before reading the body.
  if (!response.ok) {
    const errorText = await response.text();
    const errorPayload = errorText ? (JSON.parse(errorText) as CognitoJson) : {};
    const code =
      typeof errorPayload.__type === "string"
        ? (errorPayload.__type.split("#").pop() ?? "CognitoError")
        : "CognitoError";
    const message =
      typeof errorPayload.message === "string" ? errorPayload.message : response.statusText;
    throw new CognitoAccountError(message, code);
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as CognitoJson) : {};
}
