import { MfaSetupClient } from "./mfa-setup-client";

// Next 16 hands `searchParams` to pages as a Promise. We await it server-side
// so the Client Component only receives a normalized string and never touches
// `useSearchParams` (which the React-Doctor no-client-fetch rule dislikes for
// fetch-triggering effects) or `useRouter`.
type MfaSetupSearchParams = Promise<{ email?: string | string[] }>;

function normalizeEmail(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function MfaSetupPage({
  searchParams,
}: {
  searchParams: MfaSetupSearchParams;
}) {
  const params = await searchParams;
  const email = normalizeEmail(params.email);
  return <MfaSetupClient email={email} />;
}
