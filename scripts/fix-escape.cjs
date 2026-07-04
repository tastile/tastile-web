/* eslint-disable @typescript-eslint/no-require-imports */
// Restore v1.ts to a clean state with correctly escaped SQL.
const fs = require('node:fs');
const path = 'C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\e2e\\helpers\\v1.ts';
const before = fs.readFileSync(path, 'utf8');
const eol = before.includes('\r\n') ? '\r\n' : '\n';
const nl = eol;

// Find the broken lines.
const oldSnippet = '      const escaped = label.replace(/' + "'" + '/g, "' + "'" + "'" + "'" + ');';
if (!before.includes(oldSnippet)) {
  console.error('oldSnippet not found');
  process.exit(1);
}
const newSnippet = "      const escaped = label.replace(/'/g, \"''\");";
const after = before.replace(oldSnippet, newSnippet);
fs.writeFileSync(path, after);
console.log('fixed escape');
