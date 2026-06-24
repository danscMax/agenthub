# F2 — Форматтер абсолютной даты: построчное сравнение 4 копий

Все четыре делают «ISO-таймстамп → локализованная дата». Три несут баг, который четвёртая (`BackupTab`)
явно нашла и починила.

## Корень бага (комментарий BackupTab.svelte:55-57)
> `new Date('2026-06-08_030000')` yields an **Invalid Date WITHOUT throwing**, so the old try/catch never
> caught it → "Invalid Date" leaked.

То есть `try/catch` ловит толькоброшенное исключение; невалидная-непарсящаяся дата исключения не бросает —
`toLocaleString()` на ней возвращает строку «Invalid Date».

## Сравнение

| | пустой вход | защита от невалидной даты | результат при невалидной |
|---|---|---|---|
| **`ComponentCard.svelte:40-48`** `fmtTime` 🐞 | `t('common.dash')` | `try/catch` (не ловит Invalid Date) | возвращает сырой `ts` |
| **`ForksTab.svelte:103-111`** `fmtTime` 🐞 | `t('common.dash')` | `try/catch` (не ловит) | возвращает сырой `ts` |
| **`ScheduleTab.svelte:26-34`** `fmtNext` 🐞 | литерал `'—'` | `try/catch` (не ловит) | возвращает сырой `ts` |
| **`BackupTab.svelte:58-68`** `fmtAbs` ✅ | литерал `'—'` | `Number.isNaN(d.getTime())` | `snapToReadable(ts) ?? '—'`, никогда «Invalid Date» |

Код-образцы:
```ts
// 🐞 ComponentCard / ForksTab / ScheduleTab (одна форма):
try {
  const loc = locale.current === 'ru' ? 'ru-RU' : locale.current === 'zh' ? 'zh-CN' : 'en-US';
  return new Date(ts).toLocaleString(loc);
} catch { return ts; }            // <- срабатывает только на throw; Invalid Date проскакивает

// ✅ BackupTab (исправлено):
const d = new Date(ts);
if (!Number.isNaN(d.getTime())) { /* … toLocaleString … */ return d.toLocaleString(fmtLocale); }
return snapToReadable(ts) ?? '—'; // <- прочерк вместо "Invalid Date"
```

## План объединения (refactoring-ready)
1. В `src/lib/relativeTime.ts` добавить:
   ```ts
   export function formatAbsTime(ts?: string | null, opts?: { snapshotFallback?: (s: string) => string | null }): string {
     if (!ts) return t('common.dash');               // единый пустой-возврат
     const d = new Date(ts);
     if (!Number.isNaN(d.getTime())) return d.toLocaleString(localeTag());  // localeTag() — см. F12
     return opts?.snapshotFallback?.(ts) ?? t('common.dash');
   }
   ```
2. `ComponentCard.fmtTime`, `ForksTab.fmtTime`, `ScheduleTab.fmtNext` → `formatAbsTime(ts)`.
3. `BackupTab.fmtAbs` → `formatAbsTime(ts, { snapshotFallback: snapToReadable })`.
4. Решить пустой-возврат: канон `t('common.dash')` (i18n-корректный). `ScheduleTab`/`BackupTab` сейчас литерал `'—'` — привести к `t('common.dash')` либо оставить (косметика).

**Blast radius:** функции локальны, вызываются в разметке своих компонентов; тестов нет — добавить мини-тест
на «невалидный вход → dash».
**Проверка:** `npm run check` (0/0) + ручной кейс: подсунуть `'2026-06-08_030000'` в каждую из 4 точек → прочерк, не «Invalid Date».
