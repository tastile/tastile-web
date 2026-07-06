import type { CognitoEnv } from "./env";
import { cognitoRequest } from "./public-client";

export type AssociateSoftwareTokenResult = {
  secretCode: string;
  session: string;
};

export async function associateSoftwareToken(
  env: CognitoEnv,
  session: string,
): Promise<AssociateSoftwareTokenResult> {
  const response = await cognitoRequest(env, "AssociateSoftwareToken", {
    Session: session,
  });

  const secretCode = typeof response.SecretCode === "string" ? response.SecretCode : "";
  const newSession = typeof response.Session === "string" ? response.Session : session;
  if (!secretCode) {
    throw new Error("Cognito did not return a SecretCode");
  }
  return { secretCode, session: newSession };
}