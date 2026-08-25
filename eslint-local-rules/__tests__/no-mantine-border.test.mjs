import test from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import rule from '../no-mantine-border.mjs';

const linter = new Linter();

function lint(code) {
  return linter.verify(
    code,
    {
      plugins: { ds: { rules: { 'no-mantine-border': rule } } },
      rules: { 'ds/no-mantine-border': 'error' },
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
    'no-mantine-border.test.mjs',
  );
}

test('valid: JSX without a withBorder prop produces no errors', () => {
  const messages = lint('const x = <Card />;');
  assert.equal(messages.length, 0);
});

test('invalid: JSX with withBorder prop is reported with the withBorderProp messageId', () => {
  const messages = lint('const x = <Card withBorder />;');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].messageId, 'withBorderProp');
});
