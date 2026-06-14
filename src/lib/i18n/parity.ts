/**
 * i18n parity helpers — shared by the CLI gate (`scripts/check-i18n-parity.ts`) and the vitest
 * suite (`index.test.ts`) so the two never drift. Beyond key parity, this catches placeholder
 * drift and makes an accidental empty namespace visible (an empty {} is treated as a leaf, not
 * as "no keys"). A string↔object divergence at the same path surfaces as a missing/extra key.
 */

/** All leaf [path, value] pairs of a nested dict. An empty object counts as a leaf so a
 *  namespace left as `{}` in one locale is not silently invisible. */
export function leafEntries(obj: unknown, prefix = ''): [string, unknown][] {
  if (typeof obj !== 'object' || obj === null) return [[prefix, obj]];
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) return [[prefix, obj]];
  return entries.flatMap(([k, v]) => leafEntries(v, prefix ? `${prefix}.${k}` : k));
}

/** All leaf key paths (e.g. "settings.theme"). */
export function leafKeys(obj: unknown, prefix = ''): string[] {
  return leafEntries(obj, prefix).map(([k]) => k);
}

/** Names of `{placeholder}` tokens in a string, sorted and de-duplicated. */
export function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

/**
 * Compare a locale against a base. Returns human-readable problem strings (empty = parity OK):
 *  - missing / extra keys (also how a string↔object type divergence shows up)
 *  - `{placeholder}` drift on common string leaves
 */
export function comparePair(
  _baseName: string,
  base: unknown,
  otherName: string,
  other: unknown
): string[] {
  const problems: string[] = [];
  const baseMap = new Map(leafEntries(base));
  const otherMap = new Map(leafEntries(other));

  for (const k of baseMap.keys()) {
    if (!otherMap.has(k)) problems.push(`[${otherName}] missing key: ${k}`);
  }
  for (const k of otherMap.keys()) {
    if (!baseMap.has(k)) problems.push(`[${otherName}] extra key: ${k}`);
  }
  for (const [k, bv] of baseMap) {
    const ov = otherMap.get(k);
    if (typeof bv === 'string' && typeof ov === 'string') {
      const bp = placeholders(bv).join(',');
      const op = placeholders(ov).join(',');
      if (bp !== op) {
        problems.push(`[${otherName}] placeholder drift at ${k}: {${bp}} vs {${op}}`);
      }
    }
  }
  return problems.sort();
}
