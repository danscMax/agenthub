/**
 * i18n parity checker — verifies ru / en / zh expose the same leaf key paths AND the same
 * `{placeholder}` tokens (shared logic lives in src/lib/i18n/parity.ts, used by the vitest
 * suite too). Run via: npm run check:i18n. Exit 0 = parity; exit 1 = problems found.
 */

import ru from '../src/lib/i18n/locales/ru';
import en from '../src/lib/i18n/locales/en';
import zh from '../src/lib/i18n/locales/zh';
import { comparePair, leafKeys } from '../src/lib/i18n/parity';

const problems = [...comparePair('ru', ru, 'en', en), ...comparePair('ru', ru, 'zh', zh)];

if (problems.length) {
  console.error(`\ni18n parity: ${problems.length} problem(s):`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}

console.log(`i18n parity OK — ${leafKeys(ru).length} keys across ru / en / zh`);
