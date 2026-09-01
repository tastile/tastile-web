import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import noUnknownCSSVarInTokens from "./eslint-local-rules/no-unknown-css-var-in-tokens.mjs";
import noInlineCSSVarOverride from "./eslint-local-rules/no-inline-css-var-override.mjs";
import noMantineShadow from "./eslint-local-rules/no-mantine-shadow.mjs";
import noMantineBorder from "./eslint-local-rules/no-mantine-border.mjs";
import noTokenViolations from "./eslint-local-rules/no-token-violations.mjs";

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
      "**/e2e/**",
      "**/.reference/**",
      "**/.yarn/**",
      "**/scripts/**",
    ],
  },
  // Register the local-rules plugin at the top level (no `files:` filter) so
  // its rules are resolvable from every config object below. ESLint flat
  // config scopes plugins per object and rejects redefinition, so a single
  // shared declaration is the only way to reference these rules from
  // multiple scoped blocks (src/lib/theme/**, repo-wide, per-file).
  {
    plugins: {
      localRules: {
        rules: {
          "no-unknown-css-var-in-tokens": noUnknownCSSVarInTokens,
          "no-inline-css-var-override": noInlineCSSVarOverride,
          "no-mantine-shadow": noMantineShadow,
          "no-mantine-border": noMantineBorder,
          "no-token-violations": noTokenViolations,
        },
      },
    },
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
  {
    // Local rule 1 — `tokens.ts` and `css-variables-resolver.ts` are the two
    // TS sources that legitimately write `var(--xxx)` literals; lint only
    // there. Every var reference must resolve to a `--xxx` declared in
    // src/app/globals.css :root. `mantine-theme.ts` is intentionally excluded
    // — it carries pre-existing stale references (e.g. `--font-geist-mono`)
    // outside the P1 scope; flagging them belongs to a follow-up cleanup.
    files: [
      "src/lib/theme/tokens.ts",
      "src/lib/theme/css-variables-resolver.ts",
    ],
    rules: {
      "localRules/no-unknown-css-var-in-tokens": "error",
    },
  },
  {
    // Local rule 2 — flag any inline CSS-var override on JSX or style-object
    // literals anywhere in the codebase. Token plumbing (globals.css →
    // tokens.ts → Mantine theme) is the only sanctioned path to CSS
    // custom properties from components.
    rules: {
      "localRules/no-inline-css-var-override": "error",
    },
  },
  {
    // Narrow per-file exemption for rule 2. These two files declare a
    // component-local CSS custom property (`--day-view-slot-height` /
    // `--week-view-slot-height`) used by descendants to scale with the
    // user's current zoom level. The var is local to the component tree,
    // not a global token override, so the rule does not apply here.
    // Refactor candidates — track as P2 cleanup; for now the exemption
    // preserves the lint-clean state without re-touching the 2 files.
    files: [
      "src/features/manage-schedule/ui/DayPanel.tsx",
      "src/features/manage-schedule/ui/WeekPanel.tsx",
    ],
    rules: {
      "localRules/no-inline-css-var-override": "off",
    },
  },
  {
    // Local rules 3-5 — DS v2 visual baseline enforced for every consumer of
    // Mantine surfaces + Tailwind utilities. P2b sweep (Tasks 10-30) eliminates
    // pre-existing violations across src/**; P2a-introduced files (theme.ts)
    // are clean by construction (theme.ts uses Object.extend which is never
    // visited by the JSX visitor — see Ruling 2 / Ruling 7).
    rules: {
      "localRules/no-mantine-shadow": "error",
      "localRules/no-mantine-border": "error",
      "localRules/no-token-violations": "error",
    },
  },
  {
    // Per-file exemption for vendored Mantine schedule code. `shadow="md"`
    // on the Popover in MonthYearSelect renders a Mantine-elevation token
    // from the upstream component API; rewriting it requires an upstream
    // patch (src/lib/vendored/** is frozen). Track as a vendored-upstream
    // fix candidate; for now the exemption preserves the lint-clean state
    // without re-touching the vendored file.
    files: [
      "src/lib/vendored/mantine-schedule/components/ScheduleHeader/MonthYearSelect/MonthYearSelect.tsx",
    ],
    rules: {
      "localRules/no-mantine-shadow": "off",
    },
  },
];
