import { locale } from './i18n';

// Locale-aware "2 hours ago" / "через 3 дня" formatter, shared across tabs so relative
// timestamps read the same everywhere. Returns '' for missing/unparseable input.
export function relTime(ts?: string | null, now = Date.now()): string {
  if (!ts) return '';
  const d = new Date(ts).getTime();
  if (Number.isNaN(d)) return '';
  const loc = locale.current === 'ru' ? 'ru-RU' : locale.current === 'zh' ? 'zh-CN' : 'en-US';
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
  const sec = Math.round((d - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 2592000) return rtf.format(Math.round(sec / 86400), 'day');
  return rtf.format(Math.round(sec / 2592000), 'month');
}
