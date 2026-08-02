import type { CognitoEnv } from "./env";
import { cognitoRequest } from "./public-client";

export type VerifySoftwareTokenResult = {
  ok: true;
  session: string;
};

export async function verifySoftwareToken(
  env: CognitoEnv,
  session: string,
  code: string,
): Promise<VerifySoftwareTokenResult> {
  const response = await cognitoRequest(env, "VerifySoftwareToken", {
    Session: session,
    UserCode: code,
    FriendlyDeviceName: "tastile-web",
  });

  if (response.Status !== "SUCCESS") {
    throw new Error(`VerifySoftwareToken returned Status=${response.Status as string}`);
  }
  // Cognito may rotate the session during MFA_SETUP. Use the new one if present.
  const nextSession = typeof response.Session === "string" ? response.Session : session;
  return { ok: true, session: nextSession };
}
