import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const eslintConfig = defineConfig([
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  {
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/set-state-in-effect": "off",
      // Disabled because jsx-a11y does not recognize <dialog> as interactive,
      // causing false positives. Biome's a11y rules cover this correctly.
      "jsx-a11y/no-noninteractive-element-interactions": "off",
    },
  },
  {
    // Client-facing code: components, hooks, stores, context, app-wide
    // providers, layout-client shells, and error boundaries. These run in
    // the browser and must not directly reach for server-only modules,
    // credentials, or upstream event channels.
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/lib/hooks/**/*.{ts,tsx}",
      "src/lib/stores/**/*.{ts,tsx}",
      "src/lib/context/**/*.{ts,tsx}",
      "src/app/providers.tsx",
      "src/app/**/layout-client.{ts,tsx}",
      "src/app/**/error.{ts,tsx}",
    ],
    ignores: ["**/*.test.*", "**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next/headers",
                "next/server",
                "stripe",
                "@/lib/account/api-token-session",
                "@/lib/billing/server",
                "@/lib/stripe",
                "@/lib/cognito/server",
                "@/lib/cognito/account-session",
                "@/lib/cognito/authenticated-session",
                "@/lib/cognito/cookies",
                "@/lib/cognito/refresh-bridge-auth",
                "@/lib/upstream/events",
              ],
              message:
                "Client-facing code must not reach server-only modules or upstream events directly. Use a route handler or server module instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // Pure v1 domain code: interfaces only. No Next.js, Stripe, React
    // components, or feature/component imports. Dependency direction stays
    // app/components/features -> lib, never the reverse.
    files: ["src/lib/domain/v1/**/*.{ts,tsx}"],
    ignores: ["**/*.test.*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next/**",
                "stripe",
                "react",
                "react-dom",
                "@/components/**",
                "@/features/**",
                "@/lib/account/api-token-session",
                "@/lib/billing/server",
                "@/lib/stripe",
                "@/lib/cognito/server",
                "@/lib/cognito/account-session",
                "@/lib/cognito/authenticated-session",
                "@/lib/cognito/cookies",
                "@/lib/cognito/refresh-bridge-auth",
                "@/lib/upstream/events",
              ],
              message:
                "v1 domain code must remain pure: no Next.js, Stripe, React components, features, or server/provider modules.",
            },
          ],
        },
      ],
    },
  },
  {
    // Dependency direction: lib -> features is forbidden. The legitimate
    // direction is app/components/features -> lib. Exclude v1 domain
    // (stricter rule above) and the client-facing lib dirs (rules in the
    // block above already cover the @/features direction there).
    files: ["src/lib/**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.*",
      "src/lib/domain/v1/**",
      "src/lib/hooks/**",
      "src/lib/stores/**",
      "src/lib/context/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/**"],
              message:
                "lib must not import from @/features. Dependency direction is app/components/features -> lib.",
            },
          ],
        },
      ],
    },
  },
  {
    // Playwright E2E test files. They run under Node and only need a tiny
    // subset of the React/Next rules. We must provide a matching config
    // block (otherwise ESLint flags them as "no matching configuration")
    // and we strip the React/JSX/Next rules that don't apply.
    files: ["e2e/**/*.ts", "e2e/**/*.spec.ts"],
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // E2E specs use `page` as a placeholder, so `no-unused-vars` from
      // TS-ESLint would flag every helper signature. We rely on
      // TypeScript itself to enforce type correctness; unused helpers
      // surface at compile time, not as lint findings.
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Node-side JS scripts (.mjs/.cjs/.js). The build-product script, the
    // vitest runner wrapper, and one-off maintenance helpers live here.
    // JS files cannot use the TS parser (project-aware parse fails on
    // files outside tsconfig), so we rely on ESLint's default parser.
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      // The `set-env` scanner decides between module vs commonjs per file
      // based on its imports; the default ESLint behavior handles .mjs
      // (module) and .cjs (script) correctly when sourceType is omitted.
    },
    rules: {},
  },
  {
    // Node-side TypeScript scripts (`.ts`/`.mts`).
    files: ["scripts/**/*.{ts,mts}"],
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {},
  },
  globalIgnores([
    ".next/**",
    ".next-*/**",
    ".next-turbopack-broken-*/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "deploy-check/**",
    "deploy-staging/**",
    "deploy-staging2/**",
    "deploy-*/**",
    ".claude/worktrees/**",
    // Auto-generated OpenAPI types — not manually edited.
    "src/lib/api/v1/openapi-generated.d.ts",
    // Type generation script uses bun APIs (import.meta.dir) that tsc doesn't typecheck.
    "scripts/generate-openapi-types.ts",
    // Vendored Mantine schedule code — external source, not our lint surface.
    "src/lib/vendored/**",
    // One-off manual walkthrough scripts. They are scratch space for the
    // operator and not part of the lint surface (their names start with
    // `_manual_`/`_zoom*` to signal that explicitly).
    "e2e/_manual_*.js",
    "e2e/_zoom*.js",
    // PowerShell helpers (.ps1) are outside ESLint's parser scope.
    "scripts/**/*.ps1",
    "scripts/**/*.sh",
    // The shell helpers under scripts/v1 and scripts/wslc use top-of-file
    // bangs and patterns we don't want to validate against the TS rule set.
    "scripts/v1/**",
    "scripts/wslc/**",
  ]),
]);

export default eslintConfig;
