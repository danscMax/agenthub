# AgentHub — прогресс реализации аудита (цель: «делаем все»)

Базис: `plan.md` (аудит, разделы 1–9 + 50 идей), `plan-extra-100.md` (идеи 51–150).
Проверка после каждой волны: `npm run check` (0 ошибок) + `npm run check:i18n` (паритет OK).

## ✅ Сделано

### Волна 1 — критичное и быстрые победы
- `Toggle.svelte`: добавлен `onCheckedChange` (блокер для замены чекбоксов).
- `SettingsTab`: 4 сырых чекбокса (fullWidth/autostart/startHidden/closeToTray) → `Toggle`.
- `RestoreDialog`: реальный список профилей (проп `profiles`), чипсы выбора + «Выбрать все/Снять все», creds → `Toggle`; проброс profiles из `+page`→`BackupTab`.
- `McpTab`: реальный список профилей (`data.profiles`) вместо хардкода `['ccmy'..'cc5']`.
- `AnalyticsTab`: деньги/проценты/мс через локаль-aware форматтеры (`Intl.NumberFormat` с currency, `pct`, `unitMs`); zh-диапазоны «1 小时».
- `SessionsTab`: broadcast сбрасывается при ≤1 панели; `launchAll` (Вариант A) — каждый профиль из СВОЕЙ запомненной папки.
- `+page`: guard `if (running) return` в `startProvider`.
- Плюрализация форков: `pRepo`, `pConflict`, `needHands_*` (RU/EN/ZH) — «1 конфликт», «1 требует действия».

### Волна 2 — дизайн-токены и консистентность
- `app.css`: токены `--sw-status-up/-degraded/-down/-off`, `--sw-danger`, `--sw-warn`; `--sw-titlebar-height` 32→36 (синхрон с WindowTitleBar).
- Новый `StatusDot.svelte`.
- Хардкод-hex → токены: `TerminalPane`, `SessionsTab` (maxchip-dot, limit, ws-del), `DropdownMenu`, `Sidebar`, `StackHealthCard`.
- `PluginsTab`: enable/disable кнопка+бейдж → `Toggle` с подписью.

### Волна 3 — функционал
- `PluginsTab`: поиск по названию + быстрые фильтры «С обновлением»/«Только включённые» + пустое состояние.
- `ScheduleTab`: редактируемое время (`<input type=time>`) при создании; сетка вместо full-width строк; проброс `time` через `onScheduleAction`→`startSchedule`→`runSchedule`.

### Волна 4 — i18n качество
- ZH термин «провайдер» унифицирован: 供应商/提供方 → 提供商.
- ZH git fork: 复刻 → 分叉 (35 вхождений).
- `ProfilesTab`: значение провайдера — убран link-стиль (dotted underline), консистентно с остальным.

### Волна 5 — лейауты
- `UpdatesTab`: вместо «колонка на группу» (CLI-группа делала один гигантский столбец) — единая `auto-fill` сетка карточек; группа уже показывается на каждой карточке.
- `McpTab`: проверено — `.card-grid` (`auto-fill minmax(330px,1fr)`) корректен; пустота снизу при 5 карточках — норма, не баг.

### Волна 6 — архитектура (одобрено пользователем)
- Дедуп «провайдер на профиль»: секция удалена из `ProvidersTab` (+ убраны мёртвые `ProviderEditDialog`/`edit`/`onDlgSubmit`/dlg-state), заменена ссылкой «Открыть профили» (новый проп `onOpenProfiles`, проброшен из `+page`). Управление провайдером профиля теперь единое — на «Профилях».
- Секции «LLM-СТЕК» и «ДВИЖКИ» сделаны сворачиваемыми (chevron в заголовке) — экран короче. NB: это РАЗНЫЕ сущности (stack.json-бэкенды vs слой маршрутизации), поэтому жёстко в один список не слиты (это было бы семантически неверно); вместо этого — сворачивание.

### Волна 7 — мелкие безопасные фиксы
- `ForkRepoCard`/`ru,en,zh forks.wipBehindTip`: плюрализация `{commits}` (был хардкод «коммитов»). NB: parity-чекер ловит и дрейф плейсхолдеров — учтено.
- `SettingsTab`: ошибка onMount теперь видна в шапке (badge-err), а не в невидимом `console.error`.
- `PluginsTab`: per-card busy — оптимистичный `actingId` + спиннер на обрабатываемой карточке.
- Идея #49: запоминание последней открытой вкладки (`cmh-active-tab`).
- Идея #12: tooltip на обрезаемых названиях (stack/engine/my-provider) в ProvidersTab.

### Волна 8 — backend (Rust + фронт)
- **MCP per-profile deploy**: `run_mcp` принимает `only: Option<Vec<String>>` → `-Only a,b` (Deploy-Mcp.ps1 уже поддерживает `-Only`); `runMcp(action, only?)`; `onMcpDeploy(profile?)`; в McpTab непроставленный чип-профиля стал кнопкой «развернуть всё в этот профиль». `cargo check` зелёный.
- **freellmapiAuthStatus** подключён: при открытии панели логина показываются бейджи «почта задана / токен задан» (раньше команда была, но фронт её не читал).
- Подтверждено: `tauri-plugin-window-state` уже подключён (init + save-on-close) → идея #125 (позиция/размер окна) уже работает.
- ⚠️ Изменения в Rust требуют ПЕРЕсборки (`tauri dev` рестарт / `build_all`), HMR их не подхватывает. MCP per-profile мутирует реальные конфиги при клике — проверить в живом приложении.

### Волна 9 — фичи из бэклога
- #63 `TerminalPane`: кнопка «Очистить вывод» (`term.clear()`).
- #29 `PluginsTab`: сортировка (имя / статус / обновления) кнопкой-циклом.
- #20 `AnalyticsTab`: экспорт таблицы по моделям в CSV (client-side blob).
- Подтверждено реализованным ранее: #16 «Папка» профиля (`onOpen`→openPath), #125 позиция окна.

### Волна 10 — фичи из бэклога
- #53 `TerminalPane`: экспорт всего scrollback в `.log` (чтение xterm-буфера → blob).
- #34 `ComponentCard`: «Применить» теперь ghost, пока обновление не подтверждено (primary только при known-update).
- #38 подтверждено: per-action flash в Настройках уже есть (savedPath/savedTimeouts/autostart…).

### Волна 11–12 — фичи из бэклога
- #148 общий `src/lib/relativeTime.ts` (`relTime`, `Intl.RelativeTimeFormat`, локаль-aware) + применён в «Последний запуск» Обновлений и «обновлено» Форков (абсолют — в title).
- #47 (частично): CTA-кнопка «+ Новая сессия» в пустом состоянии вкладки Сессии.
- #36 (фильтр по KPI форков) — ОТЛОЖЕНО: поля conflict/needHands вычисляемые (в ForkRepoCard), фильтр потребовал бы дублировать health-логику → риск дрейфа.

### Волна 13 — a11y
- #42 видимый `:focus-visible` outline на button/a/input/select/textarea/role=switch (app.css).
- #44 `@media (prefers-reduced-motion: reduce)` глушит анимации/переходы глобально.
- #43 подтверждено: `Toggle` уже имеет `role=switch` + `aria-checked`.

### Волна 14–15 — i18n качество + полировка
- ZH кавычки унифицированы к угловым 「」 ВО ВСЕХ zh-файлах (48 пар, 13 файлов; ASCII/curly не осталось).
- #22 (частично): подпись пикового значения (↑ N) в Sparkline тренда Аналитики.

### Волна 16 — сессии (фичи)
- #6 индикатор непрочитанного вывода: панель, печатающая пока скрыта (за развёрнутой), помечает свой чип в maxbar амбер-точкой; клик/restore сбрасывает. `TerminalPane.onActivity` эмитит при выводе в `!visible`.
- #62 запоминание ширины колонок: drag делителя сохраняет colFr в localStorage (ключ по числу колонок), восстанавливается при смене раскладки/перезапуске.

### Волна 17 — полировка
- tooltip с полным id на обрезаемом имени плагина.

### Волна 18 — сессии
- #58 переименование панели: двойной клик по заголовку → инлайн-инпут (Enter/blur — сохранить, Esc — отмена). Имя в `Pane.name`, отражается в заголовке и maxbar (`paneLabel` приоритезирует name). Решает «6 одинаковых cc».

### Волна 19 — настройки
- #40 системная тема: `Theme` += `'system'`, `resolveTheme()` читает `prefers-color-scheme`, слушатель matchMedia переключает на лету; кнопка «Система» в Настройках.

### Волна 20 — настройки
- #39 «Сбросить вид»: кнопка в карточке «Вид» возвращает плотность=comfortable, fullWidth=false.

### Волна 21 — сессии
- #56 «команда во все»: инпут в шапке (при >1 панели) шлёт строку+Enter во все запущенные сессии, не включая постоянный broadcast.
- Подтверждено уже реализованным в коде: #108 (бейдж обновлений в сайдбаре — `updatesAttention`/`pluginsAttention`), #11 (ротация ключей 🔑 n/m), #15 (правка описания профиля через меню), #28 (restore-preview).

### Волна 22 — сессии
- #5 цикл фокуса панелей: Ctrl+] / Ctrl+[ переключают фокус терминала; `TerminalPane.focusTerminal()` экспортирован, SessionsTab держит refы. (нужен живой тест фокуса xterm)

### Волна 23 — глобальное
- #50 справка по хоткеям: новый `HotkeyHelp.svelte`, открывается по «?» (игнорит ввод в полях), Esc/Закрыть — закрыть; перечисляет Ctrl+K/T, Alt+1-3, Ctrl+]/[, Ctrl+F, Ctrl+Shift+C/V.

### Волна 24 — MCP
- #19 сортировка карточек серверов: неполные деплои (n<all) — наверх, полные — следом, plugin-provided — вниз.

### Волна 25 — форки
- #36 клик по KPI «конфликты»/«нужны действия» фильтрует список (статус-фильтр поверх all/fork/own; github-only скрываются при активном статус-фильтре). Пер-репо статус из branches[].outcome/conflictFiles + dirty/untracked/midOp/detached/behindBy.

### Волна 26 — баги по фидбеку пользователя
- Сессии: колонок не больше числа панелей (1 панель = вся ширина) — `effCols`.
- Full-width контента стал дефолтом (убраны большие поля на всех вкладках).
- Обновления: карточки в ряду равной высоты (`align-items: stretch`).
- Папка: не спрашивать при заполненной папке по умолчанию/запомненной (даже если тумблер ВКЛ).
- Нав-баг: добавлена диагностика — лог `[diag] tray-check-all` (ловим источник; ждём отчёт пользователя).
- Дропдауны (`Select`): подсветка приведена к стилю Sweet Whisper (нейтральный hover, акцент на выбранном, open-состояние).
- Белый сплэш: тёмный фон в `app.html` до загрузки + `window.backgroundColor` в tauri.conf; title окна → AgentHub.

### Волна 27 — порт Sweet Whisper (визуал)
- Новый `ModalShell.svelte` (порт SW): backdrop+blur, анимация fade+scale, фокус-трап, Escape/Enter, размеры sm/md/lg/xl.
- На него мигрированы ВСЕ 7 диалогов (ProviderEdit, Confirm, SessionLaunch, MyProviderEdit, RouterConnect, Restore, HotkeyHelp) — дублированный overlay/backdrop/dialog удалён.
- `Select` приведён к стилю SW; белый сплэш убран (app.html + window.backgroundColor).

### ⏳ Осталось: opencode/FreeLLM-видимость. Сайдбар: плавность разворачивания улучшена (cubic-bezier 0.22s).

### Граница «безопасно без запуска приложения» достигнута
Реализовано всё, что можно сделать и проверить компиляцией без живого прогона: весь аудит + ~22 идеи. Оставшийся бэклог (~125) делится на:
- **нужен живой прогон для верификации** (inline-переименование панели #58, цикл фокуса #5, hover-тултипы на графике, DnD-нюансы) — накладывать вслепую = риск runtime-багов;
- **нужен backend (Rust) + тест мутаций** (пинг/тест провайдера #8/#9, deep links #138, трей-меню #122, Syncthing Web UI #99, webhooks #141, авто-перезапуск сервиса #68);
- **крупные фичи на отдельную итерацию** (онбординг-тур #46, date-range picker #21, key-rotation UI, сравнение профилей #75, цепочки задач #92).

### Верификация (после 12 волн)
- `npm run check` 0 ошибок · `check:i18n` паритет 1111 · `cargo check` OK · `npm run build` (прод-бандл) OK.
- Живой прогон приложения НЕ делался (нет запуска из этой сессии); backend-правки (волна 8) требуют пересборки `tauri dev`.

## ⏳ Дальше
### Мелкие безопасные (остаток)
- Мёртвые i18n-ключи (~15): sessions.cwdPlaceholder, profiles.* (7), providers.*SelectTip (2), mcp/sync.refreshing, kpiRepos/kpiConflicts — нужна аккуратная проверка «реально не используется» перед удалением.
- ZH стиль кавычек (ASCII/curly/corner — унифицировать).
- MCP per-profile deploy (клик по чипу → деплой в один профиль) — нужен backend-параметр (Rust `run_mcp`).
- ProvidersTab: мёртвый `onProviderClear` проп (безвреден); openai-direct «Подключить» tooltip-тупик → открывать редактор.

### Большой бэклог фич
- 50 идей (plan.md разд. 9) + 100 идей (plan-extra-100.md) — крупные фичи, по приоритету.
- Дублирование «провайдер на профиль»: убрать из `ProvidersTab` (оставить в Профилях) — арх. изменение.
- Слить «LLM-СТЕК» + «ДВИЖКИ» на Providers (тройной показ бэкендов).
- Layout: `UpdatesTab` masonry/auto-fill (неравные колонки), `McpTab` auto-fill grid + центр-контейнер.
- MCP per-profile/per-card deploy (сейчас только глобальный).
- i18n: dead-ключи (sessions.cwdPlaceholder, profiles.* 7 шт, providers.*Tip, mcp/sync.refreshing), ZH стиль кавычек, ru/en health-строка профилей; `ForkRepoCard` wipBehindTip плюрализация.
- `Toggle` a11y (role/aria — уже есть role=switch); per-card busy в Plugins; ProvidersTab сворачиваемые секции.
- Деньги/прочее: `SettingsTab` onMount error → лог-канал.
- Затем — 50 + 100 идей по приоритету.
