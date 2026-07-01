// Patch QuickTileCreate.tsx to use /v1/labels for recentTags (CRLF-safe)
const fs = require('node:fs');
const path = 'C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\src\\components\\tiles\\QuickTileCreate.tsx';
const before = fs.readFileSync(path, 'utf8');
if (before.includes('v1/labels?owner_ids')) {
  console.log('already patched');
  process.exit(0);
}
const eol = before.includes('\r\n') ? '\r\n' : '\n';
const nl = eol;
const find = [
  '    // Pull recent tag candidates from the same /api/events/occurrences',
  '    // stream the day view already uses. We hit /v1/events via the BFF (the',
  '    // raw /v1/tiles projection doesn\'t carry labels).',
  '    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();',
  '    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();',
  '    fetch(',
  '      `/api/events/occurrences?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&min_minutes=0&include_recurring=true`,',
  '      { cache: "no-store" },',
  '    )',
  '      .then((r) => (r.ok ? r.json() : null))',
  '      .then((data) => {',
  '        if (!alive || !data) return;',
  '        const labels = new Set<string>();',
  '        for (const occ of (',
  '          data as {',
  '            occurrences?: Array<{ tags?: string[] }>;',
  '          }',
  '        ).occurrences ?? []) {',
  '          for (const l of occ.tags ?? []) if (l) labels.add(l);',
  '        }',
  '        setRecentTags(Array.from(labels).sort());',
  '      })',
  '      .catch(() => {',
  '        /* ignore: suggestions are best-effort */',
  '      });',
].join(nl);
if (!before.includes(find)) {
  console.error('marker not found');
  process.exit(1);
}
const replace = [
  '    // Pull recent tag candidates from the v1 labels endpoint',
  '    // (GET /v1/labels returns the deduped TIME_WINDOW annotation',
  '    // labels owned by the actor; v0 /api/events/occurrences is gone).',
  '    const owner = actorSubjectId ?? "";',
  '    fetch(',
  '      `/api/proxy/v1/labels?owner_ids=${encodeURIComponent(owner)}&limit=200`,',
  '      { cache: "no-store" },',
  '    )',
  '      .then((r) => (r.ok ? r.json() : null))',
  '      .then((data) => {',
  '        if (!alive || !data) return;',
  '        const list = Array.isArray(data) ? (data as string[]) : [];',
  '        setRecentTags(list.slice().sort());',
  '      })',
  '      .catch(() => {',
  '        /* ignore: suggestions are best-effort */',
  '      });',
].join(nl);
const after = before.replace(find, replace);
fs.writeFileSync(path, after);
console.log('patched recentTags fetch');
