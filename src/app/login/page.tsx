import { LoginPanel } from "./login-panel";

// Server component: decides which social providers are configured from
// server-only env, then renders the interactive form. Error keys come from
// the middleware / bridge redirects.

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const errorKey = typeof params?.error === "string" ? params.error : null;

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  const appleEnabled = Boolean(
    process.env.APPLE_CLIENT_ID?.trim() &&
      process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_KEY_ID?.trim() &&
      process.env.APPLE_PRIVATE_KEY?.trim(),
  );

  return (
    <LoginPanel
      googleEnabled={googleEnabled}
      appleEnabled={appleEnabled}
      initialError={errorKey}
    />
  );
}
