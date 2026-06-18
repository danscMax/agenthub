# AgentHub — Сводный отчёт UX/UI/функционального аудита

## 1. Сводка

Базовая архитектура UI здорова (есть дизайн-токены, общие компоненты `Toggle`/`Select`/`ComponentCard`, полноценная i18n на ru/en/zh), но реализация неровная: design-system применяется непоследовательно (сырые нативные чекбоксы рядом с темизированными тумблерами, хардкод цветов/паддингов мимо токенов). Три сквозные темы доминируют: (1) **дублирование управления провайдером** между вкладками «Профили» и «Провайдеры» плюс тройной показ бэкендов на «Провайдерах»; (2) **бэкенд поддерживает функции, которые UI не отдаёт пользователю** (кастомное время в Расписании, реальный список профилей в MCP, per-profile запуск сессий); (3) **русская плюрализация в KPI форков** выводит грамматически неверные «1 конфликтов / 1 требуют действий». Несколько вкладок страдают от пустых лейаутов (full-width одиночные карточки в Расписании, неравные колонки в Обновлениях).

---

## 2. Критичное и сломанное

- **[high] (M)** «Запустить все профили» стартует все панели из ОДНОЙ папки при включённом askFolder. `SessionsTab.svelte:121-130` `launchAll()` — `cwd: askFolder ? dir : ...` применяет один выбранный `dir` ко всем профилям. Нет способа замапить каждый профиль на свою папку за одно действие. Подробное решение — раздел 8.
- **[high] (S)** MCP-матрица хардкодит список профилей вместо реального с бэкенда. `McpTab.svelte:18` `ALL_PROFILES = ['ccmy','cc1','cc2','cc3','cc4','cc5']` используется в `:62-64` (бейдж n/total) и `:75` (чипы), при этом бэкенд уже отдаёт `data.profiles` (`ipc.ts:470`). Добавил/убрал профиль → знаменатель «5/6» и матрица врут. Та же литеральная копия в `RestoreDialog.svelte:21`. Фикс: `const ALL_PROFILES = $derived(data?.profiles ?? [...])`, убрать дубль в RestoreDialog.
- **[high] (S)** Денежные значения рендерятся сырым числом без округления/группировки. `AnalyticsTab.svelte:191` `${totals?.estimatedCostSavings ?? 0}` и `:250` `${m.estimatedCost}` — мимо `fmt()`. Float-артефакт `0.08000000001` или `$1234.5` без группировки. Фикс: `money = (n)=> new Intl.NumberFormat(locale,{style:'currency',currency:'USD'}).format(n??0)` для карточки экономии и колонки «Экв. стоимость».
- **[medium] (S)** Тумблер broadcast остаётся ON, но становится недостижим при схлопывании до 1 панели. `SessionsTab.svelte:308` рендерит Toggle только `{#if panes.length > 1}`, а `broadcast` (`:68`) не сбрасывается в `closePane()/closeAll()`. Ввод продолжает идти через `broadcastInput()` (`:74-76`) без возможности выключить. Фикс: `{#if panes.length > 1 || broadcast}` или сброс `broadcast=false` при `panes.length<=1`.
- **[low] (S)** `time`-параметр расписания молча теряется в обработчике страницы. `ScheduleTab.svelte:13` тип `onAction(action,id,time?)`, но `+page.svelte:854` `onScheduleAction(action,id)` и `:837` `startSchedule(action,id)` не принимают `time` — даже если передать, отбросится до `runSchedule`. Чинить вместе с разделом 7 (редактирование времени).
- **[low] (S)** `startProvider` без guard `if (running) return`. `+page.svelte:676` сразу ставит `running='provider'`, в отличие от всех сиблингов (`startRun:214`, `startForks:282`, `startMcp:510` и т.д.). При открытом confirm-диалоге `onConnectRouter:770`/`onConnectOpencode:790` запуск может затереть текущий. Фикс: добавить guard + перепроверять `running` в confirm-колбэках.
- **[low] (S)** `successRate` печатается без округления. `AnalyticsTab.svelte:175` и `:247` `{...successRate}%` полагаются на бэкенд; при float-выводе `66.66666667%`. Фикс: `(...?? 0).toFixed(1)%`.
- **[low] (S)** `console.error` глотает ошибку сохранения настроек. `SettingsTab.svelte:56` — единственная вкладка, что не пишет в in-app лог (`log = [...log, t('page.log_error',{e})]`); в собранном Tauri devtools невидим. Фикс: вывести через общий toast/log-канал.

---

## 3. Консистентность (галочки vs тумблеры и пр.)

- **[high] (M)** Сырые `<input type="checkbox">` вместо общего `Toggle.svelte` — 6 мест, БЕЗ стилизации (grep по `accent-color`/`input[type=` пуст → дефолтный OS-вид на тёмной теме). `SettingsTab.svelte:138` (fullWidth), `:186` (autostart), `:192` (startHidden), `:198` (closeToTray); `RestoreDialog.svelte:69, :78`. Settings — первый экран, который видит юзер. Это самый заметный consistency-дефект.
- **[medium] (S→M)** `Toggle.svelte` не имеет callback-prop, что и вынуждает обходной чекбокс. `Toggle.svelte:3-21` только мутирует свой `checked = !checked` (`:18`). SettingsTab нужны сайд-эффекты (`toggleAutostart:84-88`, `toggleStartHidden/CloseToTray:89-98`, `onSetFullWidth:138`). Фикс: добавить `onCheckedChange?: (v:boolean)=>void`, вызывать в onclick после флипа — bind:checked у SyncTab продолжит работать. **Это блокер для high-фикса выше — делать первым.**
- **[medium] (S)** Plugins: enable/disable как кнопка + дублирующий бейдж вместо Toggle. `PluginsTab.svelte:76-78` бейдж «включён/выключен» И `:114-120` кнопка «Выключить/Включить» — одно состояние закодировано дважды; рядом `SyncTab.svelte:143` уже использует `<Toggle>`. Фикс: один `Toggle` на `p.enabled`.
- **[low] (S)** RestoreDialog раздел 2: те же raw-чекбоксы (см. high выше) — для 6 профилей чекбокс-ряд приемлем, но должен быть стилизованным общим контролом; «Restore credentials» — естественный кандидат на `Toggle`.
- **[high] (M)** Хардкод hex статус-цветов дублируется в 3 файлах без токена/легенды. `StackHealthCard.svelte:35` `{up:'#10b981',degraded:'#f59e0b',down:'#ef4444',off:'#6b7280'}`; `TerminalPane.svelte:400/404/407` те же литералы; `SessionsTab.svelte:619` `.maxchip-dot #10b981`. Фикс: `--sw-status-up/-degraded/-down/-off` в app.css + общий `<StatusDot status=.../>` (размеры 7/9/14px уже есть).
- **[medium] (S)** Хардкод danger/warn-цветов. `#f87171` в `DropdownMenu.svelte:150` и `SessionsTab.svelte:560`; amber `#f59e0b`/`#1a1205` в `Sidebar.svelte:279-283`; warning inline `#f59e0b` в `SessionsTab.svelte:382`. Фикс: токены `--sw-danger`/`--sw-warn`. (`#e81123` close-button в `WindowTitleBar:129` — намеренный Windows-цвет, оставить.)
- **[low] (S)** ProvidersTab: разнобой капитализации заголовков. h1 `:232` обычный регистр, H2-секции `:276,335,433,478` uppercase tracking-wide, а `StackHealthCard.svelte:88` h2 без uppercase. Привести H2 к единому стилю.
- **[low] (S)** ProfilesTab: в строке провайдера смешаны link-styled `<button>` (`:396` dotted-underline → onOpenProviders) и ghost-кнопка «изменить» (`:398`). Единственный link-styled контрол на карточке. Фикс: оба как ghost, либо имя — plain-текст + «открыть Провайдеры» в … меню.
- **[low] (S)** SessionsTab `.argchip` (`:513`, `font-size:11px; padding:3px 8px`) дублирует `.chip` из `SessionLaunchDialog.svelte:165-182` с теми же значениями — две копии дрейфуют. Фикс: общий `ArgChip.svelte`/CSS-класс.
- **[low] (S)** MCP: context7/serena plugin-карточки без чипов профилей (`McpTab.svelte:69-72`) → рваная высота грида. Выровнять min-height или вынести plugin-серверы в отдельную секцию.

---

## 4. Дублирование и переусложнение

- **[high] (M)** «Провайдер на профиль» полностью дублирует управление с вкладки «Профили». `ProvidersTab.svelte:432-474` (карточки ccmy..cc5/ccfree, «Изменить»/«Сбросить», тот же `<ProviderEditDialog>`) vs `ProfilesTab.svelte:391-401` + меню «Сбросить провайдер» (`:216-223`). Обе берут одни props `providers/engines/onProviderSet/onProviderClear` из `+page.svelte`. Две независимые точки управления одной сущностью → риск рассинхрона. **Решение:** провайдер логически принадлежит профилю → оставить на «Профили», из ProvidersTab удалить `432-474`, заменить ссылкой «Открыть профили» (или read-only список без кнопок).
- **[high] (M→L)** Секции «LLM-СТЕК», «ДВИЖКИ» и «Здоровье стека» показывают один набор бэкендов трижды. Сам текст признаётся: `ru/providers.ts:11` «…тех же сервисов, что в LLM-стеке выше». Стек `ProvidersTab.svelte:272-331` (старт/стоп/дашборд), движки `:347-427` (те же + привязка/порт), `StackHealthCard` (`:269`) — третий список. **Решение:** слить стек+движки в одну секцию (одна карточка на сервис со всеми действиями), «Здоровье стека» оставить компактной сводной строкой. Сократит экран на ~треть.
- **[medium] (M)** ProvidersTab чрезмерно длинный — 5 крупных секций без сворачивания/навигации (`:269,272,333,432,476,603`). После устранения двух дубликатов выше укоротится; дополнительно — сделать тяжёлые секции сворачиваемыми (как `StackHealthCard.showDetails`) или «Свои провайдеры» в под-вкладку.
- **[low] (S)** Список ключей синка дублирован. `SyncTab.svelte:21-28` `ITEMS` и `+page.svelte:564` `const all = ['history',...]` в `onSyncApply`. Фикс: экспортировать `SYNC_ITEM_KEYS` из общего модуля, импортировать в обоих.
- **[low] (M)** Параллельные dropdown/popover. `DropdownMenu.svelte:112-124` `.menu` и `Select.svelte:163-178` `.panel` — почти идентичная панель, но shadow alpha дрейфует (0.4 vs 0.35), z-index 30 vs 60. Фикс: общий `.sw-popover` + `--sw-z-popover`.
- **[low] (L)** `ComponentCard.svelte` — общий, но ForkRepoCard/SessionsTab/ProvidersTab(12×)/PluginsTab(5×)/McpTab/ProfilesTab вручную повторяют `<div class="sw-card">` header+badge+footer. Фикс: вынести `<Card>` со слотами header/badge/footer.
- **[low] (S)** Мёртвый импорт `readEngineModels` в `+page.svelte:31` (реальные потребители — `ProviderEditDialog.svelte:85`, `RouterConnectDialog.svelte:41`). Удалить из импорта страницы.
- **[low] (S)** `runRouter` ветка `'configure'` и параметры `backend/model/name` мертвы (`ipc.ts:353-358`, единственный вызов `+page.svelte:764` `runRouter('install')`). Убрать overload или задокументировать.

---

## 5. Лейауты и отступы

- **[high] (S)** UpdatesTab: «одна группа = одна колонка» даёт жутко неравные колонки. `UpdatesTab.svelte:47-66` — section-grid-cell на группу; CLI-инструменты 6 компонентов vs Оркестратор/Claude/Git по 1 → CLI-колонка ~6× выше, справа пустота. Комментарий `:45-46` обещает «sparse groups side by side», но код этого не делает. Фикс: flat masonry/auto-fill грид с group-лейблом на карточке, либо карточки группы обтекают доступные колонки.
- **[medium] (M)** ScheduleTab: full-width одиночные карточки тратят ~70% ширины. `ScheduleTab.svelte:46` `flex flex-col gap-sw-4` — 3 задачи как full-width полосы (~1700px), бейдж «не создано» прибит к дальнему правому краю. Фикс: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-sw-4`.
- **[medium] (M)** McpTab: нижние ~80% экрана пусты, карточки в узкий ряд сверху. `card-grid` (`:51`) даёт фикс-узкие колонки; на широком окне клиппинг последней колонки (echovault). Фикс: `repeat(auto-fill/auto-fit, minmax(...))` + центрированный max-width контейнер.
- **[medium] (M)** `--sw-titlebar-height: 32px` (`app.css:40`) мёртв И неверен — `WindowTitleBar.svelte:70` хардкодит `height: 36px`. Фикс: выставить токен 36px и читать `var(...)`, либо удалить токен.
- **[medium] (M)** Хардкод px-паддингов в core chrome мимо `--sw-space-*` → density-тумблер не действует. `Sidebar.svelte:223` nav-item `11px 14px`, `:167` `11px 0`, `:158` rail `60px`; `Console.svelte:192/194`; `Select.svelte:120/144/183`; `DropdownMenu.svelte:133`; SessionsTab argchip/maxchip. Фикс: через `--sw-space-1/2/3`.
- **[low] (S)** SessionsTab: хардкод `style="color:#f59e0b"` (`:382`), `.argchip padding:3px 8px` (`:513`), `.ws-go/.ws-del 3px 8px/3px 6px` (`:543/555`), `TerminalPane.svelte:363` `.bar 4px 8px` — мимо токенов.
- **[low] (S)** `--sw-text-base: 0.875rem` (`app.css:38`) определён, нигде не используется (xs/sm используются). Удалить или принять как базовый размер контролов.
- **[low] (S)** Plugins: подзаголовок обещает «личные скиллы», но Skills-секция (`PluginsTab.svelte:129-156`) после 26 карточек. Фикс: anchor-переход из шапки или сворачиваемые секции.
- **[low] (S)** Updates: группа «Обслуживание»/bomfix (`maintenance-manifest.json:94-103`) существует, но скрыта под длинной CLI-колонкой. Решится фиксом лейаута выше; подтвердить, что bomfix намеренно показан.

---

## 6. i18n и переводы

- **[high] (S)** RU KPI форков: «1 КОНФЛИКТОВ». `ForksTab.svelte:96` статичный `t('forks.kpiConflicts')` = `ru/forks.ts:33` `'конфликтов'`. Хелпер `pConflict` существует и протестирован (`index.svelte.ts:152`, `index.test.ts:81`), но не используется. Фикс: `pConflict(s.conflict)`.
- **[high] (S→M)** RU KPI «1 ТРЕБУЮТ ДЕЙСТВИЙ» — и глагол, и существительное не согласованы. `ForksTab.svelte:97` `t('forks.kpiNeedHands')` = `'требуют действий'`; для 1 нужно «требует действия» (меняется И глагол требуют→требует, И существительное). Одного plural-noun хелпера мало. Фикс: формы `needHands_one/few/many` + `plural()`.
- **[high] (M)** ZH: три слова для «provider» — 供应商 (zh/myProviders.ts, 13×), 提供商 (zh/providers.ts 12×, nav.ts, page.ts, glossary.ts — 21 хит) и 提供方 (zh/profiles.ts:47,86,87). Фикс: единый 提供商 везде; «Свои провайдеры» → 我的提供商.
- **[medium] (M)** ZH: смешаны стили кавычек — curly “…”, ASCII "…" и CJK 「…」 в одних файлах. `zh/profiles.ts` curly (`:17,102`) + corner (`:47,95`); `zh/providers.ts` ASCII (`:101,132`) + corner (`:62`). Сводно: 14 файлов “”, 5 файлов 「」, providers.ts ASCII. Фикс: один конвенциональный стиль (corner 「」), вычистить ASCII в providers.ts.
- **[medium] (S)** ZH: 复刻 для git «fork» — неидиоматично (значит «ремейк»). `zh/nav.ts:4`, `zh/forks.ts:14`, `zh/page.ts:32,163`; также `zh/settings.ts` `'超时（复刻）'`. Фикс: 分叉 либо оставить «Fork».
- **[medium] (S)** `Intl.NumberFormat` без locale. `AnalyticsTab.svelte:49` `new Intl.NumberFormat()` — берёт OS-дефолт, не активную i18n-локаль. Фикс: `$derived` с текущей локалью из i18n-стора.
- **[medium] (M)** Sparkline без осей/тиков/тултипа — единственная визуализация «ЗАПРОСЫ ПО ВРЕМЕНИ» (`Sparkline.svelte:50-71`, `AnalyticsTab.svelte:202-206`). Юзер не видит ни окна времени, ни значений. Фикс: подписи first/last bucket + max-значение, либо hover-тултип. (Скорее раздел 7, но по сути i18n/UX-полировка.)
- **[low] (S)** RU/EN/ZH health-строка профилей кривовата. `ru/profiles.ts:4` «Здоровье {n} профилей Claude Code» неестественно; EN `'Health of {n} Claude Code {profiles}'` приемлемо но двусмысленно; ZH вставляет англо-порядок. Фикс RU: «Состояние профилей Claude Code: {n}».
- **[low] (S)** Хардкод « ms» вместо i18n. `AnalyticsTab.svelte:187, :248`. Фикс: ключ `analytics.unitMs` во всех 3 локалях.
- **[low] (S)** ZH analytics range: «1时» вместо «1小时» (`zh/analytics.ts:4,5`), при этом «7天/30天» полные. Унифицировать: «1 小时 / 24 小时 / 7 天 / 30 天».
- **[low] (S)** `wipBehindTip` хардкодит «коммитов». `ru/forks.ts:153` «…на {n} коммитов…» — не склоняется (видимые `wipBehind:151` уже используют `pCommit`). Фикс: `'…на {n} {commits}…'` + `pCommit(wipBehind)` в `ForkRepoCard.svelte:134/207`.
- **[low] (S)** kpiRepos «репозиториев» не count-aware (`ForksTab.svelte:93`, `ru/forks.ts:27`) → «1 репозиториев». Фикс: `pRepo`. (kpiMerged «влито»/kpiOpen «открыто» — наречия, не склоняются.)
- **[low] (S)** EN health word-order awkward (`en/profiles.ts:4`) — дубль RU-пункта выше для EN.

**Мёртвые i18n-ключи (все три локали, [low] S, удалить или подключить):**
- `sessions.cwdPlaceholder` (`*/sessions.ts:14`) — компоненты используют `cwdShort`.
- `profiles.*` 7 ключей: `providerStdTip:46`, `providerClear:51`, `dlgCancel:123`, `dlgApply:126`, `lcCancel:156`, `lcApply:157`, `cancel:72` — реально `common.cancel/apply` + `menuResetProvider`.
- `providers.presetSelectTip:106`, `rcProfileSelectTip:148` — `<Select>` вызывается без `title` (`ProviderEditDialog.svelte:114`, `RouterConnectDialog.svelte:99`).
- `mcp.refreshing` (`*/mcp.ts`) — код использует `common.busy` (`McpTab.svelte:41`).
- `sync.refreshing` (`*/sync.ts:7`) — `SyncTab.svelte:85` использует `common.busy`.
- `plugins.managedBadge: 'managed'` — не переведён (RU/ZH показывают англ. «managed»); решить: фикс-термин или локализовать (RU «навязан», ZH «受管»).

---

## 7. Недостаточный функционал

- **[high] (M)** Расписание: время хардкодное и нередактируемое, хотя бэкенд поддерживает кастом. `ScheduleTab.svelte:13` `onAction(action,id,time?)`, `ipc.ts:490-491` `runSchedule(...,time?)` форвардит `time ?? null`. Но UI шлёт `onAction('create',task.id)` без времени (`:82-83`); единственное время — read-only `task.defaultTime`. Фикс: `<input type="time">` на задачу (дефолт `defaultTime`) → прокинуть `time` через `onScheduleAction`→`startSchedule`→`runSchedule` (см. low-баг раздела 2). Опционально — правка времени уже созданной задачи.
- **[high] (M)** MCP: бейдж «5/6» показывает нехватку профиля, но нет per-card/per-profile деплоя. `McpTab.svelte:62-65` бейдж + серые чипы `:74-82` помечают какой профиль отсутствует, тултип `mcp.profileNotDeployedTitle` буквально говорит «нажми Развернуть», но единственное действие — глобальный `onDeploy` (`:43-46`); чипы выглядят кликабельными, но это инертные `<span>`. Фикс: сделать чипы action (deploy в один профиль) или per-card «Развернуть» при `deployedIn.length < profiles.length`; прокинуть `deploy(name, profile)`.
- **[high] (M)** Plugins: нет поиска/фильтра для 26 плагинов, хотя у соседних вкладок есть. `PluginsTab.svelte:60-124` весь список без фильтра; `ForksTab.svelte` поиск имеет. Фикс: текст-фильтр (name/market/enabled) по паттерну ForksTab + быстрые фильтры (enabled-only/has-update/managed).
- **[medium] (M)** Plugins: глобальный busy-лок гасит кнопки всех 26 карточек без per-card прогресса. `PluginsTab.svelte:31` `busy=!!running` → `disabled={busy}` на `:109,115,118`; `+page.svelte:944` `running='plugin-mgr'` на любое действие. Фикс: трекать id текущего плагина, спиннер только на затронутой карточке (как `ComponentCard.svelte:106,174-177`).
- **[medium] (S)** ProvidersTab: кнопка «Подключить» у openai-direct всегда disabled — тупик без действия. `ProvidersTab.svelte:546-550` (`connectVia==='direct' && protocol==='openai'`), тултип объясняет нужен ccr, но на карточке нет действия к исправлению. Фикс: вместо мёртвой кнопки — «Изменить способ подключения» (открыть mpEdit).
- **[medium] (M)** `freellmapiAuthStatus` экспортирован, но нигде не читается. `ipc.ts:409`; `onSetFreellmapiAuth` (`+page.svelte:754`) пишет креды, но никто не читает, сохранены ли email/токен. Фикс: показать статус в freellmapi-login UI, либо удалить мёртвый экспорт + backend-команду.
- **[low] (S)** RestoreDialog: нет «Выбрать все/Снять все» для 6 профилей (`:21-22,34,95`). Фикс: контрол инверсии над чипами.
- **[low] (S)** BackupTab: есть restore + список снапшотов (`:106-120,114`), но нет delete/prune. Фикс: «Удалить снапшот» за confirm или показать retention-политику.
- **[low] (S)** Custom-provider write-хендлеры fire-and-forget без run-lock и success-toast. `+page.svelte:710,735,740,754` (`.then(reload).catch(log)`) — в отличие от `connectMyProvider:726`/`nextProviderKey:745`. Фикс: success-toast (есть `pushToast`).
- **[low] (S)** Analytics: при refetch после первой загрузки KPI/таблица показывают stale-данные без индикатора (`:155-158` empty-card только при `!available`; «Обновить» `:148` ставит `loading=true`, но кнопки лишь disabled). Фикс: opacity/спиннер над карточками при `loading`.

---

## 8. Фикс «Запустить все профили»

**Проблема.** `SessionsTab.svelte:121-130` `launchAll()`: при `askFolder=OFF` запускает каждый профиль из своей запомненной папки (`lastFolders[p] ?? cwd` — правильно), но при `askFolder=ON` показывает ОДИН промпт папки и применяет `dir` ко ВСЕМ (`cwd: askFolder ? dir : (lastFolders[p] ?? cwd)`). Нет способа замапить профиль→своя папка за одно действие.

Используемые опоры: `launchAll()` (`:121-130`), `lastFolders` (state), `rememberFolder()`, компонент `FolderField` (используется в `SessionsTab.svelte:333` и `SessionLaunchDialog.svelte:95`).

### Вариант A — всегда стартовать из запомненной папки профиля (минимальный)
Убрать single-folder-промпт из `launchAll`: всегда `cwd: lastFolders[p] ?? cwd`, независимо от `askFolder`.
- **+** Минимум кода, чинит корень жалобы сразу, переиспользует существующий `lastFolders`/`rememberFolder()`.
- **+** «Запустить все» становится предсказуемым: «продолжить там, где каждый профиль был».
- **−** Теряется явный разовый выбор папки для всех (но это и есть баг). Для первого запуска профиля без истории fallback на `cwd` (home).
- **Трудоёмкость: S.**

### Вариант B — диалог-матрица «профиль → папка» (рекомендуется)
Заменить кнопку «Запустить все профили» на маленький диалог: список профилей, каждый со своим рядом `FolderField` (предзаполнен из `lastFolders[p] ?? cwd`), кнопка «Запустить всё» батчем.
- **+** Полный контроль: каждый профиль в своей папке за одно действие — закрывает исходную жалобу «все в одну папку».
- **+** Переиспользует `FolderField` и `rememberFolder()` (выбор сохраняется в `lastFolders`, улучшая Вариант A на будущее).
- **+** Естественное место под доп. опции (например, per-profile аргументы).
- **−** Новый компонент-диалог (~аналог `SessionLaunchDialog`), чуть больше работы и тестов.
- **Трудоёмкость: M.**

### Вариант C — именованные «наборы» (workspaces) профиль→папка
Сохранять предустановленные наборы (имя + карта профиль→папка), запускать набор одним кликом; UI уже имеет элементы `.ws-go/.ws-del` (`SessionsTab.svelte:543/555`).
- **+** Лучший UX для повторяющихся раскладок (например «Med-стек», «Эксперименты»).
- **−** Самый большой объём: персистентность наборов, CRUD-UI, миграция. Избыточно, если юзеру нужен просто разовый запуск.
- **Трудоёмкость: L.**

**Рекомендация:** **Вариант A сейчас** (мгновенно убирает баг «все в одну папку», S) + **Вариант B как полноценный UX** (диалог-матрица, переиспользует `FolderField`/`rememberFolder`, M). Вариант A естественно становится дефолтным поведением диалога B (предзаполнение из `lastFolders`). Вариант C — отдельный бэклог-айтем поверх существующих `.ws-*` контролов, только если появится спрос на сохранённые раскладки.

---

## 9. +50 дополнительных улучшений

1. [global] Глобальная палитра команд (Ctrl+K) для перехода к любой вкладке/действию — расширить существующий Ctrl+K из Sessions на всё приложение.
2. [global] Тосты с «Отменить» (undo) для деструктивных действий (закрытие панели, сброс провайдера) в течение 5 сек.
3. [sessions] Drag-and-drop переупорядочивание панелей терминала.
4. [sessions] Запоминать раскладку панелей (split/maximize) между перезапусками приложения.
5. [sessions] Горячая клавиша на циклический фокус между панелями (Ctrl+Tab / Ctrl+1..9).
6. [sessions] Бейдж непрочитанного вывода на свёрнутой/maximize-чипе, когда фоновая панель что-то напечатала.
7. [sessions] Кнопка «Перезапустить панель» для exited/error сессий прямо на чипе.
8. [providers] Кнопка «Пинг»/проверка доступности baseUrl у каждого провайдера с inline-результатом.
9. [providers] Тест-запрос (1 токен) к провайдеру для проверки ключа перед сохранением.
10. [providers] Маскирование API-ключей с глазом-toggle и кнопкой «Скопировать».
11. [providers] Индикатор «сколько ключей в ротации / какой активен» для multi-key провайдеров.
12. [providers] title={s.name}/{e.name}/{p.name} на обрезаемых h3 (`ProvidersTab.svelte:291,353,443`) для тултипа полного имени.
13. [profiles] Привязать статус-точку к реальному здоровью (зелёный=ok, amber=битые ссылки, красный=нет dir) + легенда (`ProfilesTab.svelte:362`).
14. [profiles] Дублирование/клонирование профиля как шаблона.
15. [profiles] Inline-редактирование описания по двойному клику вместо … меню.
16. [profiles] Открыть папку профиля в проводнике одной кнопкой.
17. [mcp] Кнопка «Развернуть во все недостающие» с предпросмотром diff (куда именно добавится).
18. [mcp] Поиск/фильтр серверов по имени и статусу деплоя.
19. [mcp] Группировка карточек: «развёрнуто везде» / «частично» / «из плагина».
20. [analytics] Экспорт метрик в CSV/JSON.
21. [analytics] Выбор кастомного диапазона дат (date-range picker) помимо 1ч/24ч/7д/30д.
22. [analytics] Hover-тултип на Sparkline с временем bucket и числом запросов.
23. [analytics] Разбивка стоимости по моделям в виде stacked-bar, а не только таблицы.
24. [schedule] Показывать «следующий запуск» и историю последних запусков задачи.
25. [schedule] Toggle вкл/выкл расписания без удаления.
26. [schedule] Выбор дней недели / частоты (не только ежедневно).
27. [backup] Прогресс-бар и размер при создании бэкапа.
28. [backup] Сравнение снапшота с текущим состоянием перед restore (что изменится).
29. [plugins] Сортировка плагинов (по имени/статусу/наличию обновления).
30. [plugins] Bulk-действия: «обновить все с апдейтом», «выключить все».
31. [plugins] Визуальный hint (dotted underline/info-иконка) на managed/enabled бейджах (`PluginsTab.svelte:75`).
32. [updates] Кнопка «Проверить все» с прогрессом по компонентам.
33. [updates] Показ changelog/diff для компонента перед «Применить».
34. [updates] Ослабить стиль «Применить» до ghost когда `!updateInfo.known`, primary только при подтверждённом апдейте (`ComponentCard.svelte:155-168`).
35. [forks] Унифицировать бейдж форков c summary.needHands, чтобы «1 требует внимания» и «1 с конфликтами» не противоречили (`ComponentCard.svelte:25-84`).
36. [forks] Клик по KPI-карточке фильтрует список репозиториев по этому состоянию.
37. [settings] Поиск по настройкам.
38. [settings] Per-setting текст flash вместо одинакового «Сохранено» (`SettingsTab.svelte:89-98`).
39. [settings] Кнопка «Сбросить к дефолтам» с confirm.
40. [global] Тёмная/светлая тема + системная-авто с переключателем в шапке.
41. [a11y] aria-label на всех icon-only кнопках (закрытие панели, … меню, navrail).
42. [a11y] Видимый focus-ring на всех интерактивных контролах (проверить tab-навигацию).
43. [a11y] role/aria-checked на новых Toggle, чтобы скринридеры читали состояние.
44. [a11y] Уважать prefers-reduced-motion для glow/анимаций карточек.
45. [a11y] Контраст amber-warning на тёмном фоне проверить по WCAG AA.
46. [onboarding] First-run онбординг: подсветка ключевых вкладок и «создайте первый профиль».
47. [onboarding] Пустые состояния со CTA вместо голого «нет данных» (Analytics до первых запросов, пустой список сессий).
48. [global] Индикатор глобального `running` в шапке (что именно выполняется сейчас) с возможностью отмены.
49. [global] Сохранять последнюю открытую вкладку и восстанавливать при старте.
50. [global] Хоткей-чит-лист (overlay по `?`), документирующий все горячие клавиши приложения.

---

Примечание по путям: все ссылки file:line относятся к проекту `E:\Scripts\AgentHub` (компоненты в `E:\Scripts\AgentHub\src\lib\components\`, страница `E:\Scripts\AgentHub\src\routes\+page.svelte`, локали `E:\Scripts\AgentHub\src\lib\i18n\locales\{ru,en,zh}\`, токены `E:\Scripts\AgentHub\src\app.css`).