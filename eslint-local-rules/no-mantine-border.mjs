/**
 * ESLint rule: disallow Mantine `withBorder` JSX prop.
 *
 * Background: DS v2 (P2) routes every elevation / separation through the
 * surface-elevation tokens defined in src/app/globals.css (--surface-0 /
 * --surface-1 / --surface-2 / --surface-3 / --surface-elevated) and forbids
 * any explicit border ring. Mantine's `withBorder` JSX prop renders an
 * inline 1px border on the host element, bypassing the token cascade,
 * breaking theme switching, and reintroducing design drift. Consumers must
 * reach for the surface-elevation tokens via Tailwind bg-surface-X utilities
 * / --surface-X CSS vars instead.
 *
 * Scoped to JSX only — the Mantine theme file uses Object.extend({ defaultProps:
 * { withBorder: false } }), which is ObjectExpression and never reaches the
 * JSXAttribute visitor below. The neutralization intent is preserved at
 * runtime; this rule guards the consumer surface.
 */
import { pathToFileURL } from 'node:url';
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Mantine `withBorder` JSX prop (DS v2: no borders allowed). Use surface elevation tokens instead.',
    },
    messages: {
      withBorderProp:
        'Mantine `withBorder` prop is forbidden in DS v2. Use bg-surface-X tokens for visual hierarchy instead.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'withBorder') return;
        context.report({ node, messageId: 'withBorderProp' });
      },
    };
  },
};

export default rule;

// Self-test: when this file is executed directly
// (`node eslint-local-rules/no-mantine-border.mjs`), exercise the rule against a
// representative fixture via RuleTester and exit 0 on success.
// The `pathToFileURL` adapter is required for cross-platform correctness —
// on Windows `import.meta.url` is `file:///C:/...` (forward slashes) while
// `process.argv[1]` is `C:\...` (backslashes); on POSIX both are already the
// same shape.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { RuleTester } = await import('eslint');
  const ruleTester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  });
  ruleTester.run('no-mantine-border', rule, {
    valid: ['const x = <Card />;'],
    invalid: [
      {
        code: 'const x = <Card withBorder />;',
        errors: [{ messageId: 'withBorderProp' }],
      },
      {
        code: 'const x = <Card withBorder={true} />;',
        errors: [{ messageId: 'withBorderProp' }],
      },
    ],
  });
  console.log('no-mantine-border: OK');
}
