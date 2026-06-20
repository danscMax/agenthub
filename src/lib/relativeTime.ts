import { locale, t } from './i18n';

// BCP-47 tag for the active app locale (for Intl / toLocaleString). Single source so date
// formatting reads the same everywhere (was inlined as a ternary across many components).
export function localeTag(): string {
  return locale.current === 'ru' ? 'ru-RU' : locale.current === 'zh' ? 'zh-CN' : 'en-US';
}

// Locale-aware "2 hours ago" / "через 3 дня" formatter, shared across tabs so relative
// timestamps read the same everywhere. Returns '' for missing/unparseable input.
export function relTime(ts?: string | null, now = Date.now()): string {
  if (!ts) return '';
  const d = new Date(ts).getTime();
  if (Number.isNaN(d)) return '';
  const rtf = new Intl.RelativeTimeFormat(localeTag(), { numeric: 'auto' });
  const sec = Math.round((d - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 2592000) return rtf.format(Math.round(sec / 86400), 'day');
  return rtf.format(Math.round(sec / 2592000), 'month');
}

// Absolute timestamp -> localized date/time string, tolerant of null AND unparseable input.
// `new Date('2026-06-08_030000')` yields an Invalid Date WITHOUT throwing, so a bare try/catch
// never fires and "Invalid Date" leaks to the UI — guard with Number.isNaN(getTime()) instead.
// Optional snapshotFallback renders non-ISO formats (e.g. snapshot names). Was duplicated, and
// drifted, across 4 tabs (only BackupTab carried this fix).
export function formatAbsTime(
  ts?: string | null,
  snapshotFallback?: (s: string) => string | null
): string {
  if (!ts) return t('common.dash');
  const d = new Date(ts);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString(localeTag());
  return snapshotFallback?.(ts) ?? t('common.dash');
}
