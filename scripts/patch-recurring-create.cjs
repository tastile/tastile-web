const fs = require('node:fs');
const path = 'C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\src\\components\\tiles\\QuickTileCreate.tsx';
const before = fs.readFileSync(path, 'utf8');
const eol = before.includes('\r\n') ? '\r\n' : '\n';
const nl = eol;
if (before.includes('pattern: weeklyRecurrenceMask')) {
  console.log('already patched');
  process.exit(0);
}
const oldSnippet = [
  '        const recurringRes = await createRecurringCommand({',
  '          client: makeClient(),',
  '          title: identity.title,',
  '          description: identity.description ?? null,',
  '          color: identity.visual.color,',
  '          icon: identity.visual.icon,',
  '          start: startIso,',
  '          end: endIso,',
  '          stepMs: 86_400_000,',
  '          planRole: plan.role,',
  '        });',
].join(nl);
if (!before.includes(oldSnippet)) {
  console.error('recurringRes block not found');
  process.exit(1);
}
const newSnippet = [
  '        // Build a v1 RecurrencePattern + timeOfDay from the store\'s',
  '        // recurrence.window when the user picked a weekly recurrence.',
  '        // store weekday_mask bits are Sun-first (bit 0=Sun); v1 wants',
  '        // Mon-first (bit 0=Mon..6=Sun) so re-pack the bitmask before',
  '        // handing it to the command helper.',
  '        const windowMask = recurrence?.window?.weekday_mask ?? 0;',
  '        const weeklyV1Mask = (() => {',
  '          let v1 = 0;',
  '          // store bit i (i=0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat) -> v1 bit (i+6)%7',
  '          for (let i = 0; i < 7; i++) {',
  '            if ((windowMask & (1 << i)) !== 0) {',
  '              const v1Bit = (i + 6) % 7;',
  '              v1 |= 1 << v1Bit;',
  '            }',
  '          }',
  '          return v1;',
  '        })();',
  '        const timeOfDay = (() => {',
  '          const w = recurrence?.window;',
  '          if (!w) return undefined;',
  '          const toHHMM = (mins: number) => {',
  '            const clamped = ((Math.floor(mins) % 1440) + 1440) % 1440;',
  '            const h = Math.floor(clamped / 60);',
  '            const m = clamped % 60;',
  '            return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");',
  '          };',
  '          const start = toHHMM(w.start_offset_min);',
  '          const end = toHHMM(w.end_offset_min);',
  '          if (start === end) return undefined; // all-day: use legacy path',
  '          return { start, end };',
  '        })();',
  '        const recurrencePattern = weeklyV1Mask !== 0',
  '          ? ({ kind: "weekly", weekdays: weeklyV1Mask } as const)',
  '          : undefined;',
  '        const recurringRes = await createRecurringCommand({',
  '          client: makeClient(),',
  '          title: identity.title,',
  '          description: identity.description ?? null,',
  '          color: identity.visual.color,',
  '          icon: identity.visual.icon,',
  '          start: startIso,',
  '          end: endIso,',
  '          stepMs: 86_400_000,',
  '          planRole: plan.role,',
  '          pattern: recurrencePattern,',
  '          timeOfDay,',
  '          occurrences: 14,',
  '        });',
].join(nl);
const after = before.replace(oldSnippet, newSnippet);
fs.writeFileSync(path, after);
console.log('patched recurring create call');
