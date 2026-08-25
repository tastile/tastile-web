import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Extract `--xxx` custom property names from globals.css :root / theme blocks.
 * We deliberately scan the whole file (including comments and theme override
 * blocks) so a var referenced from code matches any of the 6 theme definitions
 * it could be reading.
 */
function loadAllowedVars() {
  const cssPath = resolve(__dirname, '../src/app/globals.css');
  const css = readFileSync(cssPath, 'utf8');
  const re = /--([a-z0-9-]+)\s*:/gi;
  const allowed = new Set();
  let m;
  while ((m = re.exec(css)) !== null) {
    allowed.add(m[1]);
  }
  return allowed;
}

const allowedVars = loadAllowedVars();

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow var(--xxx) where xxx is not defined in src/app/globals.css',
    },
    schema: [],
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== 'string' || !node.value.startsWith('var(--')) {
          return;
        }
        const match = node.value.match(/^var\(--([a-z0-9-]+)\)$/);
        if (!match) {
          context.report({
            node,
            message: `CSS var reference must be exactly var(--name): ${node.value}`,
          });
          return;
        }
        const varName = match[1];
        if (!allowedVars.has(varName)) {
          context.report({
            node,
            message: `Unknown CSS var: --${varName}. Add it to src/app/globals.css :root first.`,
          });
        }
      },
    };
  },
};