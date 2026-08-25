/**
 * ESLint rule: disallow inline CSS-var overrides on JSX / style objects.
 *
 * Background: token plumbing (globals.css → tokens.ts → Mantine theme) is the
 * only sanctioned way to reach CSS custom properties from components. An
 * inline `style={{ '--xxx': value }}` on a component silently bypasses every
 * theme cascade and theme switch, and is a regression waiting to happen.
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow inline style={{ "--xxx": ... }} to prevent token cascade breakage',
    },
    schema: [],
  },
  create(context) {
    function checkObjectExpression(node) {
      if (!node.properties) return;
      for (const prop of node.properties) {
        if (prop.type !== 'Property') continue;
        const key = prop.key;
        let name;
        if (key.type === 'Identifier') name = key.name;
        else if (key.type === 'Literal') name = key.value;
        if (typeof name === 'string' && name.startsWith('--')) {
          context.report({
            node: prop,
            message: `Inline CSS var override (--${name.slice(2)}) breaks theme cascade. Use designTokens / Mantine theme instead.`,
          });
        }
      }
    }
    return {
      ObjectExpression(node) {
        let parent = node.parent;
        // JSX wraps the expression in JSXExpressionContainer; unwrap one level
        // so the parent becomes the JSXAttribute whose name we inspect.
        if (parent?.type === 'JSXExpressionContainer') parent = parent.parent;
        if (parent?.type === 'JSXAttribute' && parent.name?.name === 'style') {
          checkObjectExpression(node);
          return;
        }
        if (parent?.type === 'Property' && parent.key?.name === 'style') {
          checkObjectExpression(node);
        }
      },
    };
  },
};
