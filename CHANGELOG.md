# Changelog

All notable changes to **Castellyn** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-06-24

Parallel sessions grow up: run any tool **locally or over SSH**, spread them across **multiple monitors**, and drive everything from a redesigned launcher — plus a large reliability and DRY hardening pass.

### Added
- **SSH sessions** — run Claude / opencode / a shell on a remote host. Transport is the system `ssh` + your `~/.ssh` (keys, `known_hosts`); no secrets are stored in‑app. Host registry (saved + imported from `~/.ssh/config`) with reachability dots, an optional remote start directory, and inline server management in ⚙ Settings.
- **Multi-monitor** — pop a pane out onto another monitor (`⬈`) or "spread across monitors" as a live move (the session never dies — output fans out to every window). The arrangement persists and can be restored on launch; "forget layout" clears it.
- **Launcher redesign** — an inline *phrase* (`Run {env} [profile] on {location} in {folder} [with {args}]`) with an environment segment (Claude / opencode / shell) and **SSH as a location toggle** rather than a separate tool. Pin a whole phrase to ★ favorites for one‑click relaunch.
- Snippet menu, recent **remote-dir** suggestions (native datalist), keyboard‑shortcut hints in tooltips (Ctrl+T, Alt+1/2/3), and a toast when you pin a favorite.

### Changed
- **DRY consolidation** — a single `openDetached()` for the detach→open‑window flow; the `anchored` popover action now owns "click‑outside to close" for every popover (Select / FolderField / DropdownMenu); the snippet menu reuses the shared `DropdownMenu` (new `glyph` trigger).
- Launch args now mirror the ⚙ default‑args until you edit them, so changing the setting is reflected immediately.
- SSH reachability is probed in parallel instead of one host at a time.

### Fixed
- **Session lifecycle** — a naturally‑exited (but still‑open) pane is now reaped from the session map, freeing its slot and PTY/scrollback; the global session‑limit check and registration are atomic (no race past the cap); the `pane:add` listener is torn down on tab switch (was duplicating returned panes).
- **SSH** — reachability probes every resolved address (IPv6‑first hosts no longer false‑fail); the `~/.ssh/config` parser strips quoted values and honors `Include` (e.g. `config.d/*`).
- **Forks** — per‑repo status is written atomically (no torn read → stale card); the post‑action re‑analysis is guarded so a hiccup can’t abandon the whole run; per‑repo output files use a stable hash (no path collision); global and per‑repo runs are mutually exclusive (no concurrent `git fetch` on the same repo).
- **Popovers** — anchored menus self‑correct their position inside `backdrop-filter`/`transform`/`filter` ancestors (the `⋯` menu on fork cards landing off‑screen).
- **Windows** — a monitor window that fails to build no longer fails silently: the stashed pane is cleared and the pane is recovered into the main grid with a notification.
- Multi‑monitor windows build off the main thread (a synchronous build deadlocked WebView2 → blank window); drag‑reorder works again (native file‑drop disabled on the main window).

### Internal
- Pruned 27 dead i18n keys; ru/en/zh parity enforced (`npm run check:i18n`). Added an SSH‑config quote‑stripping unit test. All gates green: `cargo test`, `npm run check` (0/0), `npm test`, i18n parity, release build.

## [0.3.0] — 2026-06-18

First release under the **Castellyn** name (renamed from AgentHub).

### Added
- New brand: citadel icon, banner, trilingual README, in‑app logo.
- Reusable data tables (sort / search / resize / row‑expand / bulk) across Plugins & skills, MCP, Profiles and the Forks list.
- Skills/plugins **ownership** classification (items from your own local marketplace count as "mine").

_For releases 0.2.x and 0.1.0, see the [GitHub Releases](https://github.com/danscMax/castellyn/releases) page._
