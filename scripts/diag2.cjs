const fs = require('node:fs');
const path = 'C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\src\\components\\tiles\\QuickTileCreate.tsx';
const b = fs.readFileSync(path, 'utf8');
const idx = b.indexOf('Pull recent tag candidates');
console.log('idx', idx);
console.log('eol CRLF?', b.includes('\r\n'));
console.log('around', JSON.stringify(b.slice(idx, idx + 300)));
