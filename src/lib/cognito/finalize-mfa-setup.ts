import type { CognitoEnv } from "./env";
import { cognitoRequest } from "./public-client";

export type CognitoTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
};

export async function finalizeMfaSetup(
  env: CognitoEnv,
  session: string,
  email: string,
): Promise<CognitoTokens> {
  const response = await cognitoRequest(env, "RespondToAuthChallenge", {
    ClientId: env.clientId,
    ChallengeName: "MFA_SETUP",
    Session: session,
    ChallengeResponses: { USERNAME: email },
  });

  type Result = {
    IdToken?: unknown;
    AccessToken?: unknown;
    RefreshToken?: unknown;
    ExpiresIn?: unknown;
  };
  const result = response.AuthenticationResult as Result | undefined;
  const idToken = typeof result?.IdToken === "string" ? result.IdToken : "";
  const accessToken = typeof result?.AccessToken === "string" ? result.AccessToken : "";
  const refreshToken =
    typeof result?.RefreshToken === "string" ? result.RefreshToken : null;
  const expiresIn = typeof result?.ExpiresIn === "number" ? result.ExpiresIn : 3600;
  if (!idToken || !accessToken) {
    throw new Error("Cognito did not return tokens after MFA_SETUP completion");
  }
  return { idToken, accessToken, refreshToken, expiresIn };
}
