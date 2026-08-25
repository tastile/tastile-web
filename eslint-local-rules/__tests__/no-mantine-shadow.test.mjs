import test from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import rule from '../no-mantine-shadow.mjs';

const linter = new Linter();

function lint(code) {
  return linter.verify(
    code,
    {
      plugins: { ds: { rules: { 'no-mantine-shadow': rule } } },
      rules: { 'ds/no-mantine-shadow': 'error' },
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
    'no-mantine-shadow.test.mjs',
  );
}

test('valid: JSX without a shadow prop produces no errors', () => {
  const messages = lint('const x = <Card />;');
  assert.equal(messages.length, 0);
});

test('invalid: JSX with shadow="..." is reported with the shadowProp messageId', () => {
  const messages = lint('const x = <Card shadow="md" />;');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].messageId, 'shadowProp');
});