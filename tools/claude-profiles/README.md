# Vendored ClaudeProfiles binding scripts

Version-controlled copies of the provider/router binding scripts that AgentHub runs.

**Runtime still loads them from `SCRIPTS_ROOT\!Настройки и MCP\ClaudeProfiles\`** (see
`abs(...)` / the `*_SCRIPT_REL` consts in `src-tauri/src/lib.rs`). These copies exist so the
binding logic has git history and is reviewable in the repo — the live copies under
`SCRIPTS_ROOT` remain the source the app executes.

Scope: only the generic binding scripts are vendored. `config/` (machine-specific
`engines.json` / `profiles.json` with local paths) and `ProfileLib.ps1` are intentionally
**not** mirrored here — they carry machine paths that don't belong in a public repo.

When you change a script under `SCRIPTS_ROOT`, copy it here too (and vice-versa) so the
history stays meaningful. A drift check / sync helper can be added later, mirroring
`tools/Sync-ScriptKit.ps1`.

Files:
- `Manage-Provider.ps1` — bind/unbind a profile's provider (settings.json env; dummy token; tiers)
- `Connect-Router.ps1` — route a profile through ccr to an OpenAI backend
- `Setup-Router.ps1` — install/configure claude-code-router (ccr)
- `Manage-OpenCode-Provider.ps1` — bind a custom provider for the opencode agent
