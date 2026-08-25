import test from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import rule from '../no-token-violations.mjs';

const linter = new Linter();

function lint(code) {
  return linter.verify(
    code,
    {
      plugins: { ds: { rules: { 'no-token-violations': rule } } },
      rules: { 'ds/no-token-violations': 'error' },
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
    'no-token-violations.test.mjs',
  );
}

test('no-token-violations: valid (whitelisted + border-border)', () => {
  const whitelistedFixtures = [
    '<div className="bg-surface-1">x</div>',
    '<div className="border-0 border-collapse">x</div>',
    '<div className="border-transparent">x</div>',
    '<div className="border-border">x</div>',
  ];
  for (const code of whitelistedFixtures) {
    const messages = lint(code);
    assert.equal(messages.length, 0, `expected no violations for: ${code}`);
  }
});

test('no-token-violations: invalid border-* (palette names)', () => {
  const invalidBorderFixtures = [
    '<div className="border-blue-500">x</div>',
    '<div className="border-red-200">x</div>',
  ];
  for (const code of invalidBorderFixtures) {
    const messages = lint(code);
    assert.equal(messages.length, 1, `expected 1 violation for: ${code}`);
    assert.equal(messages[0].messageId, 'borderClass');
  }
});

test('no-token-violations: invalid shadow-*', () => {
  const messages = lint('<div className="shadow-lg">x</div>');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].messageId, 'shadowClass');
});

test('no-token-violations: combined-case (multiple matches per element)', () => {
  const messages = lint('<div className="border-blue-500 shadow-md">x</div>');
  assert.equal(messages.length, 2);
  const messageIds = messages.map((m) => m.messageId).sort();
  assert.deepEqual(messageIds, ['borderClass', 'shadowClass']);
});
