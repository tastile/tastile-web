import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  envDir: false,
  // The eslint-local-rules/__tests__/*.test.mjs fixtures use
  // `import test from 'node:test'` (no test-runner SDK, plain ESM).
  // Vitest 4 does NOT shim `node:test`: it exports `test` only as a
  // named binding (no default function), so a naive alias of
  // `node:test` -> `vitest` breaks them with
  // "TypeError: default is not a function". We instead rewrite the
  // import in-source for the rule fixtures so vitest's own named
  // `test` binding is used. The fixture's call sites
  // (`test('...', fn)`) work unchanged — vitest's `test` is
  // callable with the same signature as `node:test`'s default. The
  // `node:assert/strict` import is left alone (Node built-in).
  plugins: [
    {
      name: "rewrite-node-test-to-vitest",
      enforce: "pre",
      transform(code, id) {
        if (!id.includes("eslint-local-rules/__tests__/")) return;
        if (!id.endsWith(".test.mjs")) return;
        return {
          code: `import { test } from 'vitest';\n${code.replace(
            /import\s+test\s+from\s+['"]node:test['"];?/,
            "",
          )}`,
          map: null,
        };
      },
    },
  ],
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "eslint-local-rules/__tests__/*.test.mjs",
    ],
    exclude: [
      "e2e/**",
      "node_modules/**",
      "dist/**",
      ".next/**",
      ".reference/**",
      ".doctor-cache/**",
      ".claude/worktrees/**",
    ],
    // `forks` is the vitest default and recommended for native libs. The
    // legacy `test.poolOptions.forks` schema was removed in vitest 4; the
    // old wrapper used `NODE_OPTIONS=--no-warnings` plus stderr line
    // filters to silence Node 25's experimental-flag warning. We instead
    // accept the warning so the gate output is honest about what the
    // runtime emits (see evidence/web-warning-filter.txt).
    pool: "forks",
    // jsdom + Stripe mocks + Next helpers added in 0.1.16 push some
    // workers past the default 4 GB V8 ceiling. The Vitest 4 docs let
    // us pass these to the worker entry without pulling in the legacy
    // `poolOptions.forks.execArgv` shape. The trailing `--no-warnings`
    // would silence Node's own deprecation / experimental-flag chatter
    // but the plan forbids hiding warnings at the gate boundary, so we
    // instead point `--localstorage-file` at a per-worker temp file so
    // Node's "provided without a valid path" warning (emitted by
    // Node 22+ when --localstorage is on but the path is empty) is
    // resolved at the source rather than filtered at the boundary.
    execArgv: [
      "--max-old-space-size=8192",
      "--localstorage-file=node_modules/.cache/vitest-localstorage.json",
    ],
    // Default env for test workers. Only set if not already present in
    // process.env, so CI overrides still win. We deliberately do NOT
    // load `.env.local` here — it carries `E2E_BYPASS_AUTH=1` and
    // other production-shape flags that flip auth/owner-derivation
    // paths and break the negative-path tests (`/api/me` should 401
    // when no id_token cookie is present, not short-circuit on
    // E2E_BYPASS_AUTH and return 200). CLOUD_API_BASE /
    // TASTILE_RUST_API_URL are the only env vars the component tests
    // actually need (via `getCloudApiBase({ assert: true })`); other
    // keys from .env.local stay unset during tests on purpose.
    env: {
      CLOUD_API_BASE: "http://127.0.0.1:31400",
      TASTILE_RUST_API_URL: "http://127.0.0.1:31400",
      NEXT_PUBLIC_TASTILE_CORE_URL: "http://127.0.0.1:31400",
      NEXT_PUBLIC_DAEMON_BASE_URL: "http://127.0.0.1:31400",
      E2E_BYPASS_AUTH: "",
      NEXT_PUBLIC_E2E_BYPASS_AUTH: "",
    },
    // Coverage targets follow policy §29. Thresholds are enforced only when
    // coverage is enabled (`bunx vitest run --coverage`); the standard
    // `bun run check` gate stays at the iteration floor and does not collect
    // coverage. Bring the suite to 80% lines/statements/functions/branches
    // before wiring `coverage` into `bun run check`.
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/__tests__/**",
        "src/**/__mocks__/**",
        "src/**/*.d.ts",
        "src/test/**",
        "src/lib/api/v1/openapi-generated.{d.ts,ts}",
        "src/**/index.ts",
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
