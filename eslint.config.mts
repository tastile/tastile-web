import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/vitest.config.ts",
      "**/eslint.config.mts",
      "**/biome.json",
      "**/knip.json",
      "**/package.json",
      "**/tsconfig.json",
      "**/src/test/**",
      "**/src/shared/**",
      "**/src/views/**",
      "**/src/widgets/**",
      "**/src/features/**",
      "**/src/components/**",
      "**/e2e/**",
      "**/.reference/**",
      "**/.yarn/**",
      "**/scripts/**",
    ],
  },
  {
    files: ["**/src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // ESLint acts as the second lint layer behind Biome. Biome owns
      // formatting + the bulk of static analysis; ESLint owns the
      // cross-cutting anti-patterns Biome does not flag. The rule below
      // is the canonical no-json-parse-stringify-clone guard from
      // .agents/skills/react-doctor — `structuredClone` is faster,
      // preserves Date/Map/Set, and crashes on cycles loudly instead of
      // silently dropping data.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='JSON'][callee.property.name='parse'][arguments.0.callee.object.name='JSON'][arguments.0.callee.property.name='stringify']",
          message:
            "Use `structuredClone(x)` instead of `JSON.parse(JSON.stringify(x))`. See .agents/skills/react-doctor.",
        },
      ],
    },
  },
];
