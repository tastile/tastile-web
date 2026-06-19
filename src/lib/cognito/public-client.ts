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

export type EmailOtpStartResult = {
  session: string;
  challengeName: string;
};

export type PasswordlessSignUpResult = {
  userConfirmed: boolean;
  session: string | null;
};

export async function signUpPasswordlessEmail(
  env: CognitoEnv,
  email: string,
): Promise<PasswordlessSignUpResult> {
  const response = await cognitoRequest(env, "SignUp", {
    ClientId: env.clientId,
    Username: email,
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

export async function startEmailOtpSignIn(
  env: CognitoEnv,
  email: string,
): Promise<EmailOtpStartResult> {
  const initial = await cognitoRequest(env, "InitiateAuth", {
    AuthFlow: "USER_AUTH",
    ClientId: env.clientId,
    AuthParameters: {
      USERNAME: email,
      PREFERRED_CHALLENGE: "EMAIL_OTP",
    },
  });

  if (initial.ChallengeName === "EMAIL_OTP" && typeof initial.Session === "string") {
    return { session: initial.Session, challengeName: "EMAIL_OTP" };
  }

  if (initial.ChallengeName === "SELECT_CHALLENGE" && typeof initial.Session === "string") {
    const selected = await cognitoRequest(env, "RespondToAuthChallenge", {
      ClientId: env.clientId,
      ChallengeName: "SELECT_CHALLENGE",
      Session: initial.Session,
      ChallengeResponses: {
        USERNAME: email,
        ANSWER: "EMAIL_OTP",
      },
    });
    if (selected.ChallengeName === "EMAIL_OTP" && typeof selected.Session === "string") {
      return { session: selected.Session, challengeName: "EMAIL_OTP" };
    }
  }

  throw new CognitoPublicError(
    "Email OTP sign-in is not available for this user.",
    "EMAIL_OTP_UNAVAILABLE",
  );
}

export async function completeEmailOtpSignIn(
  env: CognitoEnv,
  email: string,
  code: string,
  session: string,
): Promise<CognitoAuthTokens> {
  const response = await cognitoRequest(env, "RespondToAuthChallenge", {
    ClientId: env.clientId,
    ChallengeName: "EMAIL_OTP",
    Session: session,
    ChallengeResponses: {
      USERNAME: email,
      EMAIL_OTP_CODE: code,
    },
  });

  const result = response.AuthenticationResult as CognitoJson | undefined;
  const idToken = typeof result?.IdToken === "string" ? result.IdToken : "";
  const accessToken = typeof result?.AccessToken === "string" ? result.AccessToken : "";
  const refreshToken = typeof result?.RefreshToken === "string" ? result.RefreshToken : null;
  const expiresIn = typeof result?.ExpiresIn === "number" ? result.ExpiresIn : 3600;
  if (!idToken || !accessToken) {
    throw new CognitoPublicError("Cognito did not return tokens.", "TOKEN_MISSING");
  }
  return { idToken, accessToken, refreshToken, expiresIn };
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
    throw new CognitoPublicError(message, code);
  }
  return payload;
}
