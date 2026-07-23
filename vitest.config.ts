import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["e2e/**", "node_modules/**", "dist/**", ".next/**", ".claude/worktrees/**"],
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
    // `poolOptions.forks.execArgv` shape.
    execArgv: ["--max-old-space-size=8192"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
