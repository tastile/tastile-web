import { DashboardLayoutClient } from "./layout-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auth is enforced upstream by `src/proxy.ts` (Cognito id_token cookie) so
  // reaching this layout means the user is already authenticated. The
  // E2E_BYPASS_AUTH flag is also handled by the proxy, so no second gate is
  // needed here.
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
