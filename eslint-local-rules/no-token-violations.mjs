/**
 * ESLint rule: disallow DS v2-violating Tailwind border-* and shadow-* classes
 * inside `className` strings.
 *
 * Background: DS v2 (P2) routes every elevation / separation through the
 * surface-elevation tokens defined in src/app/globals.css (--surface-0 /
 * --surface-1 / --surface-2 / --surface-3 / --surface-elevated) and forbids
 * Tailwind border palette utilities (e.g. `border-blue-500`) and the entire
 * `shadow-*` family. The standard border token `border-border` (Tailwind
 * `border-color: var(--color-border)`) is whitelisted, as is `bg-surface-elevated`
 * (legitimate DS v2 surface token).
 *
 * Scoped to JSX `className` attributes. The rule regex-scans the literal string
 * for the two forbidden families and reports one violation per match with a
 * precise loc so editor squiggles land on the exact utility.
 */
import { pathToFileURL } from 'node:url';

const BORDER_REGEX = /\bborder-(?!0\b|collapse\b|spacing\b|transparent\b|border(?:\b|\/))[a-z0-9./-]+/g;
const SHADOW_REGEX = /\bshadow-(?:sm|md|lg|xl|inner|none)\b/g;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Tailwind border-* (except 0/collapse/spacing/transparent/border) and shadow-* classes (DS v2).',
    },
    schema: [],
    messages: {
      borderClass:
        'Tailwind `border-*` class is forbidden in DS v2 (except `border-0` / `border-collapse` / `border-spacing` / `border-transparent` / `border-border`). Use surface elevation tokens or `<Divider />` instead.',
      shadowClass:
        'Tailwind `shadow-*` class is forbidden in DS v2. Use bg-surface-X tokens for visual hierarchy instead.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'className') return;
        if (node.value?.type !== 'Literal' && node.value?.type !== 'JSXExpressionContainer') return;
        const className =
          node.value?.type === 'Literal'
            ? String(node.value.value)
            : String(node.value?.expression?.value ?? '');
        if (!className) return;
        const sourceCode = context.getSourceCode();
        const baseOffset = node.value.range[0];
        for (const match of className.matchAll(BORDER_REGEX)) {
          context.report({
            node,
            loc: {
              start: sourceCode.getLocFromIndex(baseOffset + match.index),
              end: sourceCode.getLocFromIndex(baseOffset + match.index + match[0].length),
            },
            messageId: 'borderClass',
          });
        }
        for (const match of className.matchAll(SHADOW_REGEX)) {
          context.report({
            node,
            loc: {
              start: sourceCode.getLocFromIndex(baseOffset + match.index),
              end: sourceCode.getLocFromIndex(baseOffset + match.index + match[0].length),
            },
            messageId: 'shadowClass',
          });
        }
      },
    };
  },
};

export default rule;

// Self-test: when this file is executed directly
// (`node eslint-local-rules/no-token-violations.mjs`), exercise the rule against a
// representative fixture via RuleTester and exit 0 on success.
// The `pathToFileURL` adapter is required for cross-platform correctness —
// on Windows `import.meta.url` is `file:///C:/...` (forward slashes) while
// `process.argv[1]` is `C:\...` (backslashes); on POSIX both are already the
// same shape.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { RuleTester } = await import('eslint');
  const tester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  });

  tester.run('no-token-violations', rule, {
    valid: [
      { code: '<div className="bg-surface-1">x</div>' },
      { code: '<div className="border-0 border-collapse">x</div>' },
      { code: '<div className="border-transparent">x</div>' },
      { code: '<div className="border-border">x</div>' },
      { code: '<div className="border-border/30">x</div>' },
    ],
    invalid: [
      {
        code: '<div className="border-border-bg">x</div>',
        errors: [{ messageId: 'borderClass' }],
      },
      {
        code: '<div className="border-blue-500">x</div>',
        errors: [{ messageId: 'borderClass' }],
      },
      {
        code: '<div className="shadow-lg">x</div>',
        errors: [{ messageId: 'shadowClass' }],
      },
    ],
  });
  console.log('no-token-violations: OK');
}
