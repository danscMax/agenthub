# F1 — PowerShell-скрипты ↔ Rust-двойники (построчная карта)

**Вывод:** 7 скриптов в `tools/claude-profiles/` полностью реализованы заново на Rust в `lib.rs`.
**Приложение спавнит только Rust.** Доказательство: `grep _SCRIPT_REL src-tauri/src/lib.rs` → спавнятся
лишь Backup/Restore/Profiles/Install/Repair/Relink/Integrity/Schedule/Mcp-Deploy + Stack-Procs; ни один из 7
ниже там не значится. Все ссылки на них в `lib.rs` — `///`-комментарии.

| PowerShell-скрипт (мёртв в приложении) | Rust-двойник (исполняется) | Комментарий-маркер в lib.rs |
|---|---|---|
| `tools/claude-profiles/Manage-Provider.ps1` | `manage_provider_native` `lib.rs:2378` + `apply_provider_env` `lib.rs:2426` | `:2372` «Native port of Manage-Provider.ps1»; `:2536` «native; was Manage-Provider.ps1» |
| `tools/claude-profiles/Connect-Router.ps1` | `connect_router_native` `lib.rs:2091` (+ cmd `run_connect_router` `:2174`) | `:2087` «Native port of Connect-Router.ps1» |
| `tools/claude-profiles/Setup-Router.ps1` | `setup_router_native` `lib.rs:2043` + `apply_router_config` `lib.rs:1961` | `:2040` «Native port of Setup-Router.ps1»; `:2145` «native; was Setup-Router.ps1» |
| `tools/claude-profiles/Manage-OpenCode-Provider.ps1` | `opencode_provider_native` `lib.rs:3696` (+ cmd `:3833`) | `:3692` «Native port of Manage-OpenCode-Provider.ps1» |
| `tools/claude-profiles/Manage-Engine.ps1` | `run_engine` `lib.rs:1869` (+ `load_engine_cfg` `:1778`, `spawn_engine_detached` `:1837`) | `:1865` «native; was Manage-Engine.ps1» |
| `tools/claude-profiles/Check-Provider.ps1` | `probe_provider` `lib.rs:3290` (+ cmds `check_my_provider` `:3384`, `check_provider_url` `:3401`) | `:3288` «Native provider liveness probe (was Check-Provider.ps1)» |
| `tools/claude-profiles/Connect-CustomProvider.ps1` | `connect_custom_native` `lib.rs:3025` (из `connect_my_provider` `:3209`) | `:3020` «Native port of Connect-CustomProvider.ps1» |

## Внутренние дубли в этих скриптах (subsumed — исчезают при удалении)
| Дубль | Места | Уже унифицировано в Rust? |
|---|---|---|
| BOM-чтение JSON-конфига | `Manage-Provider.ps1:75`, `Manage-OpenCode-Provider.ps1:64`, `Setup-Router.ps1:66`, `Manage-Engine.ps1:42` | да — `parse_json_bom` `lib.rs:200` |
| backup-then-write UTF-8-no-BOM | `Manage-Provider.ps1:139`, `Manage-OpenCode-Provider.ps1:126`, `Setup-Router.ps1:97` | да — `write_file_no_bom` `lib.rs:1001` |
| secret-from-STDIN | `Manage-Provider.ps1:43`, `Manage-OpenCode-Provider.ps1:50`, `Connect-CustomProvider.ps1:31`, `Check-Provider.ps1:21` | да — приходит по Tauri IPC |
| HTTP-error-status decode | `Check-Provider.ps1:42`, `Connect-CustomProvider.ps1:56/86` | да — `probe_provider` ветки статусов |
| port-listener find | `Manage-Engine.ps1:103`, `Connect-Router.ps1:46`, `Stack-Procs.ps1:23` | да — `listeners_on_port` `lib.rs:1797`, `port_listening` `lib.rs:1291` |
| ⚠ `ProfileLib.ps1` dot-source | `Manage-Provider.ps1:51` (зовёт `Get-ClaudeProfiles`) | файла **нет в репо** — скрипт упал бы при запуске (но он не запускается) |

## Развилка решения (нужен выбор владельца)
- **A. Удалить** `tools/claude-profiles/{Manage-Provider,Connect-Router,Setup-Router,Manage-OpenCode-Provider,Manage-Engine,Check-Provider,Connect-CustomProvider}.ps1` и перевесить sentinel-комментарий
  `agenthub-local` (CLAUDE.md) на Rust `lib.rs:2469`. Blast radius в приложении = 0.
- **B. Оставить как референс/внешнюю поставку** → добавить шапку `# DEPRECATED — not invoked by the app; native impl in lib.rs` и строку в `docs/ARCHITECTURE.md`.
- **Не трогать сейчас** (оставить в беклоге) — если статус миграции ещё открыт.

Проверка после A: `npm run build` + `.\build_all.ps1`; вкладки Providers/Router/Engine/OpenCode работают
(нативный путь). Никаких изменений поведения — удаляется только неисполняемый код.
