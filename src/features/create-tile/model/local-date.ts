// The date picker yields "YYYY-MM-DD", which `new Date()` would read as UTC
// midnight (09:00 in JST). Build the instant in the user's local calendar
// instead, keeping the local time-of-day already chosen for the span.
export function localDateToIso(value: string, currentIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "";
  const current = currentIso ? new Date(currentIso) : null;
  const keep = current && !Number.isNaN(current.getTime()) ? current : null;
  const d = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    keep ? keep.getHours() : 0,
    keep ? keep.getMinutes() : 0,
  );
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
