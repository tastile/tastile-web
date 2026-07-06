import type { CognitoEnv } from "./env";

type CognitoJson = Record<string, unknown>;

export class CognitoPublicError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export type CognitoAuthTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
};

export type AuthChallenge =
  | "EMAIL_OTP"
  | "PASSWORD"
  | "PASSWORD_SRP"
  | "MFA_SETUP"
  | "SOFTWARE_TOKEN_MFA"
  | "SELECT_CHALLENGE";

export type PasswordSignInResult = {
  session: string;
  challengeName: AuthChallenge;
};

export type PasswordlessSignUpResult = {
  userConfirmed: boolean;
  session: string | null;
};

export async function signUpWithPassword(
  env: CognitoEnv,
  email: string,
  password: string,
): Promise<PasswordlessSignUpResult> {
  const response = await cognitoRequest(env, "SignUp", {
    ClientId: env.clientId,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
  return {
    userConfirmed: response.UserConfirmed === true,
    session: typeof response.Session === "string" ? response.Session : null,
  };
}

export async function confirmSignUp(env: CognitoEnv, email: string, code: string): Promise<void> {
  await cognitoRequest(env, "ConfirmSignUp", {
    ClientId: env.clientId,
    Username: email,
    ConfirmationCode: code,
  });
}

export async function resendConfirmationCode(env: CognitoEnv, email: string): Promise<void> {
  await cognitoRequest(env, "ResendConfirmationCode", {
    ClientId: env.clientId,
    Username: email,
  });
}

export async function startPasswordSignIn(
  env: CognitoEnv,
  email: string,
  password: string,
): Promise<PasswordSignInResult> {
  const initial = await cognitoRequest(env, "InitiateAuth", {
    AuthFlow: "USER_AUTH",
    ClientId: env.clientId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  if (initial.ChallengeName === "SELECT_CHALLENGE" && typeof initial.Session === "string") {
    const selected = await cognitoRequest(env, "RespondToAuthChallenge", {
      ClientId: env.clientId,
      ChallengeName: "SELECT_CHALLENGE",
      Session: initial.Session,
      ChallengeResponses: {
        USERNAME: email,
        ANSWER: "PASSWORD",
        PASSWORD: password,
      },
    });
    return pickChallenge(selected, email);
  }

  return pickChallenge(initial, email);
}

function pickChallenge(response: CognitoJson, _email: string): PasswordSignInResult {
  const cn = response.ChallengeName;
  if (typeof cn !== "string") {
    throw new CognitoPublicError("Cognito did not return a challenge name.", "NO_CHALLENGE");
  }
  if (typeof response.Session !== "string") {
    throw new CognitoPublicError(`Cognito returned ${cn} without a session`, "MISSING_SESSION");
  }
  if (
    cn !== "MFA_SETUP" &&
    cn !== "SOFTWARE_TOKEN_MFA" &&
    cn !== "PASSWORD_SRP" &&
    cn !== "EMAIL_OTP"
  ) {
    throw new CognitoPublicError(`Unexpected challenge: ${cn}`, "UNEXPECTED_CHALLENGE");
  }
  return { session: response.Session, challengeName: cn as AuthChallenge };
}

export async function completeMfaChallenge(
  env: CognitoEnv,
  email: string,
  code: string,
  session: string,
  challengeName: "SOFTWARE_TOKEN_MFA" | "EMAIL_OTP" = "SOFTWARE_TOKEN_MFA",
): Promise<CognitoAuthTokens> {
  const challengeResponses: Record<string, string> = { USERNAME: email };
  if (challengeName === "EMAIL_OTP") {
    challengeResponses.EMAIL_OTP_CODE = code;
  } else {
    challengeResponses.SOFTWARE_TOKEN_MFA_CODE = code;
  }

  const response = await cognitoRequest(env, "RespondToAuthChallenge", {
    ClientId: env.clientId,
    ChallengeName: challengeName,
    Session: session,
    ChallengeResponses: challengeResponses,
  });

  const result = response.AuthenticationResult as CognitoJson | undefined;
  const idToken = typeof result?.IdToken === "string" ? result.IdToken : "";
  const accessToken = typeof result?.AccessToken === "string" ? result.AccessToken : "";
  const refreshToken = typeof result?.RefreshToken === "string" ? result.RefreshToken : null;
  const expiresIn = typeof result?.ExpiresIn === "number" ? result.ExpiresIn : 3600;
  if (!idToken || !accessToken) {
    throw new CognitoPublicError(
      "Cognito did not return tokens after MFA challenge",
      "TOKEN_MISSING",
    );
  }
  return { idToken, accessToken, refreshToken, expiresIn };
}

export async function cognitoRequest(
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
    throw new CognitoPublicError(message, code);
  }
  return payload;
}
