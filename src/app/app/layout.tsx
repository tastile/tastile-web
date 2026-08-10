import { AppLayoutClient } from "./layout-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Auth gate runs on the client in `AppLayoutClient` so this segment is
  // statically generated; server-side redirects would otherwise turn every
  // /dashboard URL into a dynamic route.  Dev/CI bypass uses the same
  // /api/auth/session contract as production.
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
