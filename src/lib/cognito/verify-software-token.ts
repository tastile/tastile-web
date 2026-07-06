import type { CognitoEnv } from "./env";
import { cognitoRequest } from "./public-client";

export type VerifySoftwareTokenResult = {
  idToken: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  challengeName?: string;
  session?: string;
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

  if (
    response.ChallengeName === "MFA_SETUP" &&
    typeof response.Session === "string"
  ) {
    return {
      idToken: "",
      accessToken: "",
      refreshToken: null,
      expiresIn: 0,
      challengeName: "MFA_SETUP",
      session: response.Session,
    };
  }

  const result = response.AuthenticationResult as
    | {
        IdToken?: unknown;
        AccessToken?: unknown;
        RefreshToken?: unknown;
        ExpiresIn?: unknown;
      }
    | undefined;

  return {
    idToken: typeof result?.IdToken === "string" ? result.IdToken : "",
    accessToken: typeof result?.AccessToken === "string" ? result.AccessToken : "",
    refreshToken: typeof result?.RefreshToken === "string" ? result.RefreshToken : null,
    expiresIn: typeof result?.ExpiresIn === "number" ? result.ExpiresIn : 0,
  };
}