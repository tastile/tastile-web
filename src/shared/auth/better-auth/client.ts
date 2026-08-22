import { twoFactorClient } from "better-auth/plugins/two-factor";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});
