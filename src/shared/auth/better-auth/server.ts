import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins/bearer";
import { twoFactor } from "better-auth/plugins/two-factor";
import { Pool } from "pg";

import { getPublicOrigin } from "@/shared/auth/public-origin";
import { ensureWebSignupGateSchema } from "@/lib/migrations/web-signup-gate";
import { resolveAuthDatabaseUrl } from "./database-url";
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

async function authDatabase(): Promise<Pool> {
  if (!cachedPool) {
    const connectionString = process.env.TASTILE_AUTH_DATABASE_URL;
    let hyperdriveConnectionString: string | undefined;
    if (!connectionString?.trim()) {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const cloudflare = getCloudflareContext();
      const hyperdrive = (cloudflare.env as { HYPERDRIVE?: { connectionString?: string } }).HYPERDRIVE;
      hyperdriveConnectionString = hyperdrive?.connectionString;
    }
    const resolvedConnectionString = resolveAuthDatabaseUrl(connectionString, hyperdriveConnectionString);
    if (!resolvedConnectionString) {
      throw new Error("[auth] TASTILE_AUTH_DATABASE_URL or HYPERDRIVE is required for the BetterAuth store");
    }
    cachedPool = new Pool({ connectionString: resolvedConnectionString, max: 5 });
  }
  return cachedPool;
}

// web#258: when TASTILE_SIGNUP_ALLOWED_EMAIL_DOMAINS is set, self-service
// sign-up is restricted to the listed email domains (comma-separated,
// case-insensitive). Unset/empty keeps the current open behavior; the
// acceptance deployment sets it to `tastile-acceptance.invalid` so only
// fixture accounts can be created while the env is public.
function signupAllowedDomains(): string[] | null {
  const raw = process.env.TASTILE_SIGNUP_ALLOWED_EMAIL_DOMAINS?.trim();
  if (!raw) return null;
  const domains = raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return domains.length > 0 ? domains : null;
}

function socialProviders() {
  const providers: Record<string, unknown> = {};
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const googleAndroidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID?.trim();
  if (googleClientId && googleClientSecret) {
    const clientIds = googleAndroidClientId
      ? [googleClientId, googleAndroidClientId]
      : [googleClientId];
    providers.google = { clientId: clientIds, clientSecret: googleClientSecret };
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

async function createAuth() {
  const publicOrigin = getPublicOrigin();
  const pool = await authDatabase();
  // web#258: install the signup gate (policy + invite tables, trigger on
  // `user`) eagerly; the trigger arm is skipped until BetterAuth's schema
  // exists and is retried lazily from the before-hook on signup paths.
  await ensureWebSignupGateSchema(pool).catch(() => undefined);
  return betterAuth({
    baseURL: publicOrigin,
    basePath: "/api/auth",
    database: pool,
    trustedOrigins: [publicOrigin],
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
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
      // Email ownership confirmation is optional for the minimal release.
      // Keep the sender hook available for explicit verification flows.
      sendOnSignUp: false,
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
      // Hyperdrive-backed pg.Pool connections are shared across Worker
      // isolates. Cache the signed session payload briefly so every
      // authenticated request does not reserve another RDS connection.
      // This is an HMAC-signed cache, not an auth bypass; callers that need
      // an authoritative database read can pass disableCookieCache=true to
      // BetterAuth's getSession API.
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        strategy: "compact",
        refreshCache: false,
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // web#258: signup-capable paths re-ensure the gate schema so the
        // `user` trigger is installed even when BetterAuth created its
        // tables after createAuth ran.  A failure here fails the signup
        // closed rather than bypassing the registration gate.
        if (
          ctx.path.startsWith("/sign-up/") ||
          ctx.path.startsWith("/callback/")
        ) {
          await ensureWebSignupGateSchema(await authDatabase());
        }
        if (ctx.path !== "/sign-up/email") return;
        const allowed = signupAllowedDomains();
        if (!allowed) return;
        const body = ctx.body as { email?: unknown } | undefined;
        const email = typeof body?.email === "string" ? body.email : "";
        const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
        if (!domain || !allowed.includes(domain)) {
          throw new APIError("FORBIDDEN", {
            message: "Sign-up is not available for this email address.",
          });
        }
      }),
    },
    plugins: [bearer(), twoFactor(), nextCookies()],
  });
}

export type AuthInstance = Awaited<ReturnType<typeof createAuth>>;

let cachedAuth: Promise<AuthInstance> | null = null;

export function getAuth(): Promise<AuthInstance> {
  if (!cachedAuth) {
    cachedAuth = createAuth();
  }
  return cachedAuth;
}
