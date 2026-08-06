import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? "bun run dev";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: webServerCommand,
    env: {
      E2E_BYPASS_AUTH: "0",
      NEXT_PUBLIC_E2E_BYPASS_AUTH: "0",
      NEXT_PUBLIC_DAEMON_BASE_URL: "http://localhost:31400",
      TASTILE_USE_RUST_CORE: "1",
      TASTILE_RUST_API_URL: "http://127.0.0.1:31400",
      COOKIE_USER_SUB: "e2e-bridge-test-user",
      TASTILE_WEB_BRIDGE_SECRET: "dev-e2e-secret",
    },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
