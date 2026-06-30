# UI Polish & Feature Gap — Implementation Plan

Декомпозиция всех улучшений на безопасные, независимые порции.
Каждая фаза = одна feature-ветка → merge → следующая.

---

## Фаза 0: CSS-only (0 риска)

### 0.1 — Сплиттер консоли шире + hover-подсветка

**Файл:** `src/lib/components/Console.svelte:93,148-156`

```
.resizer { height: 10px; margin-top: -5px; }
.resizer:hover { background: var(--sw-accent); }
```

**Проверка:** `npm run check && npm run build`

### 0.2 — Анимация переключения табов

**Файл:** layout или обёртка в `+page.svelte`

Оборачиваешь `<div class="tab-content">` вокруг `{#key active}...{/key}` + CSS:

```css
.tab-content { animation: tab-fade 0.12s ease; }
@keyframes tab-fade { from { opacity: 0.6; } to { opacity: 1; } }
```

Не затрагивает сессии (и так lazy-load).

### 0.3 — Empty states для табов

**Файлы:** каждый `*Tab.svelte`, где данные могут быть null.

Добавить блок вида:
```svelte
{#if !data}
  <div class="empty-state">
    <span class="empty-icon">…</span>
    <p>{t('tab.empty')}</p>
  </div>
{/if}
```

Новые i18n-ключи: `tab.empty.*` в `ru.json`, `en.json`, `zh.json`.
ОБЯЗАТЕЛЬНО добавить в `parity.ts` и прогнать `npm run check:i18n`.

### 0.4 — Подсветка логов в консоли

**Файл:** `src/lib/components/Console.svelte:134`

Заменить плоский `.join('\n')` на рендеринг строк с классами:

- Строки с `✔` / `code: 0` / `done` → зелёный
- Строки с `⚠` / `err` / `code: -1` → красный
- Остальные — как есть

Можно через `{#each log as line}` + условие на префикс.

---

## Фаза 1: Компоненты (средний риск)

### 1.1 — Unicode → SVG иконки в сайдбаре

**Файл:** `src/lib/components/Sidebar.svelte:24-38`

- Выбрать сет (Heroicons outline 20x20 или Lucide)
- 14 иконок, встроить как `<svg>` в массив `items`
- Удалить `it.icon` (string) → `it.icon` (html)
- `{@html it.icon}` вместо `{it.icon}`

Сет на 14 иконок ~2KB gzip. Не затрагивает i18n, не затрагивает бэкенд.

### 1.2 — Показывать цвет профиля в карточке

**Файл:** `src/lib/components/ProfilesTab.svelte`

У каждой карточки профиля поверхность `{color}` навесить:

- `style="border-left: 3px solid {profile.color}"` на карточку
- или цветной кружок рядом с именем

Без логики — чисто CSS-атрибут.

### 1.3 — Empty states: плейсхолдеры с подсказками

Новые компоненты `EmptyState.svelte` + использование в табах.
Для каждого таба — своя иконка + текст + action-кнопка (опционально).

**Проверка:** убедиться, что пустой таб не вызывает ошибок рендера, когда данные = `null`.

---

## Фаза 2: i18n + новые строки

### 2.1 — Добавить все недостающие i18n ключи

Пробежаться по всем пустым стейтам, разметке и подписям.

**Команды:** `npm run check:i18n` (прогоняет `parity.ts`), `npm test` (i18n parity тест).

**Правило:** каждый новый `t('ns.key')` = ключ во всех трёх локалях. `parity.ts` упадёт, если забыл.

---

## Фаза 3: Новые фичи (высокий риск — каждая отдельно)

### 3.1 — Changelog для плагинов

**Файлы:** `src/lib/components/PluginsTab.svelte`, `src/lib/ipc.ts`

- Новый Rust-команд `list_plugin_releases(id)` → парсит GitHub Releases API
- Новая колонка/кнопка «Changelog» в строке плагина
- Модалка с распаршенным markdown

**Риск:** GitHub API rate limit. Кешировать.

### 3.2 — Diff-view для config drift

**Файлы:** `src/lib/components/SyncTab.svelte`, `src-tauri/src/lib.rs`

- Новый Rust-команд `read_drift_diff(path)` → сравнивает файл с его `*-shared` копией
- Возвращает строки unified diff
- UI подсвечивает `+зелёный` / `-красный`

### 3.3 — Notification history

**Файлы:** `src/lib/toast.svelte`, `ToastHost.svelte`

- Добавить в toastStore историю (макс 50)
- Новый интерфейс: иконка колокольчика в сайдбаре или Settings → панель «Recent notifications»

### 3.4 — Progress bar для долгих операций

**Файл:** `src/routes/+page.svelte`, `WindowTitleBar.svelte`

- Rust шлёт `run-progress` события с `{current, total}` (требует доработки каждого PS-скрипта)
- Или аппроксимировать: `run-done` для каждого подкомпонента

**Зависимость:** доработка бэкенда (Rust + PS-скрипты). Самая рискованная.

### 3.5 — Undo для restore/delete

**Файл:** `src/lib/ipc.ts`, `src-tauri/src/lib.rs`

- Перед restore — сохранить `restore-undo-{timestamp}.json`
- UI: после restore показать toast «Undo» на 15s
- По нажатию — `run_backup('restore', { timestamp: undo_timestamp })`

### 3.6 — Метрики выполнения скриптов (гистограмма)

**Файлы:** `AnalyticsTab.svelte`, `src-tauri/src/lib.rs`

- Читать все `*.last.json` за последние N дней
- Визуализировать `durationSec` по дням для каждого компонента

---

## Фаза 4: Power-user фичи (самые сложные)

### 4.1 — Кастомизация хоткеев

**Файл:** `src/routes/+page.svelte`, `SettingsTab.svelte`, `src-tauri/src/lib.rs`

- Хранить маппинг `{ action → accelerator }` в `config.json`
- UI: редактор хоткеев в Settings
- Rust: регистрировать через `global-shortcut` плагин Tauri

### 4.2 — Глобальный поиск

**Файл:** `CommandPalette.svelte`

- Расширить Ctrl+K поиском по: профилям, репозиториям, MCP-серверам, плагинам, настройкам
- Каждый результат → переключение на соответствующий таб + подсветка

### 4.3 — Сессии: свернуть в фон

**Файл:** `SessionsTab.svelte`

- Кнопка «🗕» на панели → скрывает из грида, PTY живёт
- Новая секция «background sessions» под гридом

---

## Порядок выполнения

```
Фаза 0.1 — Console resize handle
Фаза 0.2 — Tab fade animation
Фаза 0.4 — Console log colors
Фаза 1.1 — Sidebar SVG icons
Фаза 0.3 — Empty state компонент
Фаза 2.1 — i18n parity
Фаза 1.2 — Profile card colors
Фаза 3.3 — Notification history
Фаза 3.5 — Undo for restore
Фаза 3.1 — Plugin changelog
Фаза 3.2 — Config drift diff
Фаза 4.3 — Session background
Фаза 4.1 — Hotkey customization
Фаза 4.2 — Global search
Фаза 3.4 — Progress bar
Фаза 3.6 — Script metrics
```

---

## Чеклист для каждой ветки

- [ ] `git checkout -b feat/<name>` от актуального `main`
- [ ] Внести изменения
- [ ] `npm run check` — 0 errors, 0 warnings
- [ ] `npm test` — все зелёные
- [ ] `npm run build` — успешно
- [ ] Если есть новые i18n-ключи: `npm run check:i18n` + parity тест
- [ ] Визуально проверить в `npm run tauri dev` (или `npm run dev` для UI)
- [ ] `git commit` с сообщением по шаблону `feat(scope): what changed`
- [ ] `git push`
- [ ] Создать PR → merge в `main`

---
*Castellyn UI Polish — 2026-06-30*
