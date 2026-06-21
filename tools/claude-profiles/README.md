# ClaudeProfiles binding scripts (superseded by native Rust)

The provider/router/engine binding logic that Castellyn once shelled out to PowerShell for is now
implemented **natively in Rust** in `src-tauri/src/lib.rs`:

| Former script | Native replacement |
|---|---|
| `Manage-Provider.ps1` | `manage_provider_native` |
| `Connect-Router.ps1` | `connect_router_native` |
| `Setup-Router.ps1` | `setup_router_native` |
| `Connect-CustomProvider.ps1` | `connect_custom_native` |
| `Manage-OpenCode-Provider.ps1` | `opencode_provider_native` |
| `Manage-Engine.ps1` | `run_engine` |
| `Check-Provider.ps1` | `probe_provider` |

The app **no longer spawns any of these scripts**. The seven files now live under `legacy/` for
historical reference only — see `legacy/README.md`. `Manage-Provider.ps1` additionally dot-sources a
`ProfileLib.ps1` that isn't in the repo, so it can't run standalone.

The `agenthub-local` dummy-token sentinel that these scripts used to set is implemented natively in
`lib.rs` and asserted by the Rust test suite, independent of the legacy scripts.

> `config/` (machine-specific `engines.json` / `profiles.json`) and `ProfileLib.ps1` were never
> mirrored here — they carry machine paths that don't belong in a public repo.
