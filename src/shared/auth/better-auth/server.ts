import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins/bearer";
import { twoFactor } from "better-auth/plugins/two-factor";
import { Pool } from "pg";

import { getPublicOrigin } from "@/shared/auth/public-origin";
import {
  passwordResetEmailHtml,
  sendAuthEmail,
  verificationEmailHtml,
} from "./mailer";

// BetterAuth server instance (ADR 2026-08-22: Cognito → BetterAuth).
//
// Database: dedicated auth schema on the same private RDS instance, reached
// with a least-privilege role (TASTILE_AUTH_DATABASE_URL). The web server's
// direct-DB exception covers ONLY this role — core domain tables are not
// reachable with it.
//
// Identity contract: the better-auth user id becomes the bridge
// `x-tastile-web-session-user` value; tastile-core derives the v1 owner via
// UUIDv5(NAMESPACE_OID, id) exactly as it did for cognito_sub.

let cachedPool: Pool | null = null;

function authDatabase(): Pool {
  if (!cachedPool) {
    const connectionString = process.env.TASTILE_AUTH_DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "[auth] TASTILE_AUTH_DATABASE_URL is required for the BetterAuth store",
      );
    }
    cachedPool = new Pool({ connectionString, max: 5 });
  }
  return cachedPool;
}

function socialProviders() {
  const providers: Record<string, unknown> = {};
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (googleClientId && googleClientSecret) {
    providers.google = { clientId: googleClientId, clientSecret: googleClientSecret };
  }
  // Sign in with Apple: APPLE_CLIENT_SECRET is the pre-signed ES256 client
  // secret JWT (better-auth 1.7 consumes a clientSecret, not raw key parts).
  const appleClientId = process.env.APPLE_CLIENT_ID?.trim();
  const appleClientSecret = process.env.APPLE_CLIENT_SECRET?.trim();
  if (appleClientId && appleClientSecret) {
    providers.apple = { clientId: appleClientId, clientSecret: appleClientSecret };
  }
  return providers;
}

function createAuth() {
  return betterAuth({
    basePath: "/api/auth",
    database: authDatabase(),
    trustedOrigins: [getPublicOrigin()],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: "Reset your Tastile password",
          html: passwordResetEmailHtml(url),
          devUrl: url,
        });
      },
    },
    emailVerification: {
      // Send the confirmation mail immediately at sign-up so the flow has
      // no dead end (dev: link is logged when SES is not configured).
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: "Confirm your Tastile email address",
          html: verificationEmailHtml(url),
          devUrl: url,
        });
      },
    },
    socialProviders: socialProviders(),
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    plugins: [bearer(), twoFactor(), nextCookies()],
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;

let cachedAuth: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  if (!cachedAuth) {
    cachedAuth = createAuth();
  }
  return cachedAuth;
}

