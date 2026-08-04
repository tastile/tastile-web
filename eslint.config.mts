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
    rules: {},
  },
];
