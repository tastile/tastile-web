import { RuleTester } from 'eslint';
import rule from '../no-unknown-css-var-in-tokens.mjs';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-unknown-css-var-in-tokens', rule, {
  valid: [
    { code: "const x = 'var(--background)';" },
    { code: "const y = 'var(--primary)';" },
    { code: "const z = 'var(--surface-1)';" },
    { code: "const w = 'var(--spacing-nested-md)';" },
  ],
  invalid: [
    {
      code: "const x = 'var(--nonexistent-token)';",
      errors: [{ message: /Unknown CSS var: --nonexistent-token/ }],
    },
    {
      code: "const x = 'var(--background)suffix';",
      errors: [{ message: /must be exactly var\(--name\)/ }],
    },
  ],
});