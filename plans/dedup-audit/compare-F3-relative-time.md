# F3 — «N назад»: построчное сравнение `fmtAgo` ↔ канон `relTime`

Один смысл («сколько времени прошло»), три реализации с разной презентацией.

## Канон: `src/lib/relativeTime.ts:5-18`
```ts
export function relTime(ts?: string | null, now = Date.now()): string {
  if (!ts) return '';
  const d = new Date(ts).getTime();
  if (Number.isNaN(d)) return '';
  const loc = locale.current === 'ru' ? 'ru-RU' : locale.current === 'zh' ? 'zh-CN' : 'en-US';
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
  const sec = Math.round((d - now) / 1000); const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 2592000) return rtf.format(Math.round(sec / 86400), 'day');
  return rtf.format(Math.round(sec / 2592000), 'month');   // <- есть бакет "месяцы"
}
```
Используется корректно в `ForksTab.svelte:190`, `ComponentCard.svelte:126`.

## Копия 1+2 — байт-в-байт идентичны (`ProfilesTab.svelte:70-79`, `SyncTab.svelte:29-38`)
```ts
function fmtAgo(ms?: string) {
  if (!ms) return '';
  const then = Date.parse(ms);
  if (isNaN(then)) return '';
  const ago = Math.round((Date.now() - then) / 1000);
  if (ago < 60) return t('common.justNow');
  if (ago < 3600) return t('common.minutesAgo', { n: Math.floor(ago / 60) });
  if (ago < 86400) return t('common.hoursAgo', { n: Math.floor(ago / 3600) });
  return t('common.daysAgo', { n: Math.floor(ago / 86400) });   // <- нет "месяцев"
}
```

## Вариант 3 — `HomeTab.svelte:26-30` (другой контракт)
```ts
function ageStr(h: number) {                       // <- на входе ЧАСЫ, не таймстамп
  if (h < 1) return t('common.minutesAgo', { n: Math.max(1, Math.round(h * 60)) });
  if (h < 48) return t('common.hoursAgo', { n: Math.round(h) });   // <- порог 48ч, не 24ч
  return t('common.daysAgo', { n: Math.round(h / 24) });
}
```

## Различия (что именно разошлось)
| | вход | механизм | презентация | бакеты |
|---|---|---|---|---|
| `relTime` (канон) | ISO-строка | `Intl.RelativeTimeFormat` | locale-aware Intl | sec/min/hour/day/**month** |
| `fmtAgo` ×2 | ISO-строка | ручные пороги + i18n-ключи | `t('common.*Ago')` + `justNow` | min/hour/day |
| `ageStr` | **часы (number)** | ручные пороги | `t('common.*Ago')` | min/hour(<48)/day |

Итог: на одних вкладках «2 hours ago» (Intl), на других «2 ч назад» (ключи) — видимая несогласованность.

## План объединения
1. **`ProfilesTab.fmtAgo`, `SyncTab.fmtAgo` → `relTime(ts)`** (удалить обе локальные функции).
2. **i18n-ключи `common.justNow/minutesAgo/hoursAgo/daysAgo` НЕ удалять** — их использует `HomeTab.ageStr`.
3. `HomeTab.ageStr` — оставить (другой контракт: на вход часы) ЛИБО переписать на `relTime`, пересчитав часы
   в `Date.now() - h*3600_000`. Рекоменд.: оставить (меньше риска), пометить `// ponytail: distinct contract`.

**Blast radius:** `fmtAgo` зовётся в разметке Profiles/Sync — рендеринг сменится с ключей на Intl-форму
(numeric:'auto' может дать «вчера»/«yesterday» вместо «1 день назад» — это улучшение, но визуально заметно).
**Проверка:** `npm test` (i18n parity не сломан, т.к. ключи остаются) + глазами на вкладках Profiles/Sync.
