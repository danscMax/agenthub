// Helpers for reading the unified status envelope (`{ status, counts:{changed,failed}, … }`).
// Shared by outcome.ts, ComponentCard and UpdatesTab so the envelope-reading rules (and their
// legacy fallbacks) can't drift apart between the toast layer and the cards.

// counts.changed / counts.failed, falling back to the legacy `changed[]` array length and the
// older `plugins_changed` / `plugins_failed` numbers for any not-yet-migrated writer.
export function countOf(s: any, key: 'changed' | 'failed'): number {
  if (s?.counts && typeof s.counts[key] === 'number') return s.counts[key] as number;
  const arr = s?.[key];
  if (Array.isArray(arr)) return arr.length;
  const num = s?.[`plugins_${key}`];
  return typeof num === 'number' ? num : 0;
}
