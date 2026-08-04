import type { RuleModule } from "eslint";
import type { Linter } from "eslint";
import { clearCaches } from "@typescript-eslint/typescript-estree";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import nextPlugin from "@next/next-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "jsx-a11y";

declare module "@typescript-eslint/eslint-plugin" {
  interface RuleModuleOptions {
    ignore: boolean;
    ignorePattern: RegExp | RegExp[] | string | string[];
  }
}

const rules: Record<string, RuleModule> = {
  "no-undef": "off",
  "@typescript-eslint/no-unused-vars": "off",
  "no-unsafe-optional-chaining": "warn",
  "no-unsafe-negation": "warn",
  "no-unsafe-argument": "warn",
  "no-unsafe-assignment": "warn",
  "no-unsafe-call": "warn",
  "no-unsafe-member-access": "warn",
  "no-unsafe-return": "warn",
  "no-unsafe-enum-comparison": "warn",
  "no-unsafe-type-assertion": "warn",
  "no-unsafe-function-type": "warn",
  "no-unsafe-implicit-any": "warn",
  "no-this-alias": "warn",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-imports": "error",
  "no-unsafe-implicit-any": "warn",
  "no-var": "error",
  "use-isnan": "error",
};

const config: Linter.Config = {
  env: {
    es2020: true,
    node: true,
    browser: true,
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y", "next"],
  rules,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  reportUnusedDisableDirectives: false,
};

export default config;
