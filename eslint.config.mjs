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
  globalIgnores([
    ".next/**",
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
    "e2e/**",
    "scripts/**",
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
