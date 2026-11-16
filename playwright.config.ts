import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? "bun run dev";
const coreUrl = process.env.PLAYWRIGHT_CORE_URL ?? "http://localhost:31400";
const e2eAuthBypass = process.env.PLAYWRIGHT_E2E_BYPASS_AUTH === "1" ? "1" : "0";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 120_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: webServerCommand,
    env: {
      E2E_BYPASS_AUTH: e2eAuthBypass,
      NEXT_PUBLIC_E2E_BYPASS_AUTH: e2eAuthBypass,
      CLOUD_API_BASE: coreUrl,
      NEXT_PUBLIC_DAEMON_BASE_URL: coreUrl,
      NEXT_PUBLIC_TASTILE_CORE_URL: coreUrl,
      TASTILE_USE_RUST_CORE: "1",
      TASTILE_RUST_API_URL: coreUrl,
      COOKIE_USER_SUB: "e2e-bridge-test-user",
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
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 13"] },
      testMatch: /mobile-/,
    },
    {
      name: "mobile-pixel",
      use: { ...devices["Pixel 5"] },
      testMatch: /mobile-/,
    },
  ],
});
