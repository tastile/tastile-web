/**
 * ESLint rule: disallow Mantine `shadow="..."` JSX prop.
 *
 * Background: DS v2 (P2) routes every elevation through the surface-elevation
 * tokens defined in src/app/globals.css (--elevation-1 / --elevation-2 /
 * --elevation-3). Mantine's `shadow="..."` prop renders an inline
 * `box-shadow` CSS rule that bypasses the token cascade, breaks theme
 * switching, and reintroduces design drift. Consumers must reach for the
 * surface-elevation tokens via Tailwind / CSS classes instead.
 *
 * Scoped to JSX only — the Mantine theme file uses Object.extend({ defaultProps:
 * { shadow: undefined } }), which is ObjectExpression and never reaches the
 * JSXAttribute visitor below. The neutralization intent is preserved at
 * runtime; this rule guards the consumer surface.
 */
import { pathToFileURL } from 'node:url';
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Mantine shadow="..." JSX prop; use DS v2 elevation tokens instead',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'shadow') return;
        context.report({
          node,
          message:
            'Mantine shadow prop bypasses DS v2 elevation tokens. Use --elevation-* CSS var or Tailwind elevation utility instead.',
        });
      },
    };
  },
};

export default rule;

// Self-test: when this file is executed directly
// (`node eslint-local-rules/no-mantine-shadow.mjs`), exercise the rule against a
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
  ruleTester.run('no-mantine-shadow', rule, {
    valid: ['const x = <Card />;'],
    invalid: [
      {
        code: 'const x = <Card shadow="md" />;',
        errors: [
          {
            message: /Mantine shadow prop bypasses DS v2 elevation tokens/,
          },
        ],
      },
    ],
  });
  console.log('no-mantine-shadow: OK');
}