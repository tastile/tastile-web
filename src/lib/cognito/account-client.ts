import type { CognitoEnv } from "./env";

type CognitoJson = Record<string, unknown>;

export class CognitoAccountError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export type CognitoUserProfile = {
  username: string;
  email: string | null;
  emailVerified: boolean;
  userStatus: string | null;
  preferredUsername: string | null;
};

export async function getCognitoUser(
  env: CognitoEnv,
  accessToken: string,
): Promise<CognitoUserProfile> {
  const response = await cognitoRequest(env, "GetUser", {
    AccessToken: accessToken,
  });
  const attributes = Array.isArray(response.UserAttributes) ? response.UserAttributes : [];
  const map = new Map<string, string>();
  for (const attribute of attributes) {
    if (
      attribute &&
      typeof attribute === "object" &&
      typeof (attribute as { Name?: unknown }).Name === "string" &&
      typeof (attribute as { Value?: unknown }).Value === "string"
    ) {
      map.set((attribute as { Name: string }).Name, (attribute as { Value: string }).Value);
    }
  }
  return {
    username: typeof response.Username === "string" ? response.Username : "",
    email: map.get("email") ?? null,
    emailVerified: map.get("email_verified") === "true",
    userStatus: typeof response.UserStatus === "string" ? response.UserStatus : null,
    preferredUsername: map.get("preferred_username") ?? null,
  };
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
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as CognitoJson) : {};
  if (!response.ok) {
    const code =
      typeof payload.__type === "string"
        ? (payload.__type.split("#").pop() ?? "CognitoError")
        : "CognitoError";
    const message = typeof payload.message === "string" ? payload.message : response.statusText;
    throw new CognitoAccountError(message, code);
  }
  return payload;
}
