import { RuleTester } from 'eslint';
import rule from '../no-inline-css-var-override.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run('no-inline-css-var-override', rule, {
  valid: [
    { code: "const s = { color: 'red' };" },
    { code: "<div style={{ color: 'red' }} />" },
    { code: "<Button style={{ padding: 8 }} />" },
  ],
  invalid: [
    {
      code: "<div style={{ '--background': 'red' }} />",
      errors: [{ message: /Inline CSS var override/ }],
    },
    {
      code: "const s = { style: { '--primary': 'red' } };",
      errors: [{ message: /Inline CSS var override/ }],
    },
  ],
});
