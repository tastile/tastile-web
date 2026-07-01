import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    env: {
      E2E_BYPASS_AUTH: "1",
      NEXT_PUBLIC_E2E_BYPASS_AUTH: "1",
      NEXT_PUBLIC_DAEMON_BASE_URL: "http://localhost:31400",
      TASTILE_USE_RUST_CORE: "1",
      TASTILE_RUST_API_URL: "http://127.0.0.1:31400",
    },
    url: "http://127.0.0.1:3000",
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
