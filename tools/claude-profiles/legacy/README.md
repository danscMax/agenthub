# Legacy ClaudeProfiles binding scripts (superseded — historical reference only)

These PowerShell scripts are **dead**. Each was fully reimplemented as a native Rust
command in `src-tauri/src/lib.rs`, and Castellyn no longer spawns any of them (none appears
as a `*_SCRIPT_REL` path constant, and none is launched through `spawn_streamed` or any
`Command`). They are kept here purely for historical reference and git history.

## What replaced each script (native Rust in `src-tauri/src/lib.rs`)

| Legacy script                  | Native Rust replacement      |
| ------------------------------ | ---------------------------- |
| `Setup-Router.ps1`             | `setup_router_native`        |
| `Connect-Router.ps1`           | `connect_router_native`      |
| `Manage-Provider.ps1`          | `manage_provider_native`     |
| `Connect-CustomProvider.ps1`   | `connect_custom_native`      |
| `Manage-OpenCode-Provider.ps1` | `opencode_provider_native`   |
| `Manage-Engine.ps1`            | `run_engine`                 |
| `Check-Provider.ps1`           | `probe_provider`             |

## Why they can't simply be run again

Beyond being unreferenced, `Manage-Provider.ps1` dot-sources a `ProfileLib.ps1` helper that
is **not present** in this repository (machine-specific config and `ProfileLib.ps1` were
intentionally never mirrored here — see the note in `../README.md`). As a result it cannot
run standalone from this folder.

Do not wire these back into the app. If the binding logic needs to change, edit the native
Rust implementations above; these copies exist only so the original PowerShell logic stays
reviewable in history.
