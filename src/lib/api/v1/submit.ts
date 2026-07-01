/**
 * makeClient — construct an ApiClient for the web app.
 *
 * Honors `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` for local development: when set,
 * `getIdToken` returns the dev token instead of calling Cognito. The v1
 * daemon must be configured to accept the token (out of scope here).
 */

import { getIdTokenClient } from "@/lib/daemon/id-token-client";
import type { ApiClient } from "./endpoints";

/**
 * Dev / E2E bypass token. Returned by `getIdToken` when
 * `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` so the v1 client doesn't fail with
 * FORBIDDEN_NO_TOKEN during local development. The v1 daemon must be
 * configured to accept this token (out of scope for this module).
 */
const E2E_DEV_TOKEN = "e2e-bypass-token";

export function makeClient(): ApiClient {
  const e2eBypass = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1";
  const rawBaseUrl = process.env.NEXT_PUBLIC_DAEMON_BASE_URL ?? "";
  const useProxyBridge = e2eBypass || shouldUseProxyBridge(rawBaseUrl);
  return {
    baseUrl: useProxyBridge ? "/api/proxy" : rawBaseUrl,
    useProxyBridge,
    getIdToken: async () => {
      if (e2eBypass) return E2E_DEV_TOKEN;
      return getIdTokenClient();
    },
  };
}

function shouldUseProxyBridge(value: string): boolean {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return true;
  }
  if (value === "") return false;
  try {
    const url = new URL(value);
    return !(
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "10.0.2.2"
    );
  } catch {
    return false;
  }
}
