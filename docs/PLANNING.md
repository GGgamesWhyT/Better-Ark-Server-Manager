# Better Ark Server Manager — Planning

Last updated: 2025-08-16

## Scope update

You requested two key additions:
- Integrated mod search by mod name inside the app.
- A complete, user-friendly UI to edit all Ark server settings without touching INI files (parity with ASM), modern and cross‑platform.

This document refines the plan to meet those goals and outlines implementation details and milestones.

## Requirements checklist

- SteamCMD auto-install and management (Windows/Linux)
- One-click Ark server installation to a chosen directory
- Branch selection: stable (default) and beta
- Start/Stop/Restart server; show status (Online/Offline/Updating)
- Mod search by name (Steam Workshop) and add by ID
- Manage mods: list, enable/disable, order, remove; auto-update mods on start
- Full settings UI: expose all known Ark server options, searchable and categorized
- Advanced INI editors for GameUserSettings.ini and Game.ini (still available)
- Server update checks and "Update Now" button
- Clear logs and status from server and SteamCMD

## Architecture overview

- Electron main process: lifecycle, IPC, process management, filesystem, SteamCMD integration
- Preload: secure IPC bridge (contextIsolation)
- Renderer: HTML/CSS/JS UI (no heavy framework initially)
- Services (Node in main):
  - steamcmdManager: download/update/run scripts, branch selection
  - serverManager: install/update/start/stop/status; args builder
  - modManager: search, add/remove, reorder, update on start
  - configManager: read/write INIs; settings registry mapping <-> UI
  - logManager: stream + persist logs
  - settingsStore: persisted JSON (paths, branch, mods, server config)

Data locations: App settings under Electron userData; server install path chosen by user.

## Mod search by name (design)

Primary approach: Steam Web API IPublishedFileService.QueryFiles
- Endpoint: https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/
- Requires a Steam Web API key (user-provided; stored locally). Provide an input field and validation.
- Query parameters:
  - appid: 346110 (Ark: Survival Evolved)
  - search_text: <user keywords>
  - return_short_description=1, return_vote_data=1, return_children=0, return_metadata=1
  - query_type: 9 (Ranked By Text Search) or default sorted by trend/subs
  - page, numperpage (pagination)
- Response mapping for UI list rows:
  - id (publishedfileid), title, author (creator), subscriptions, favorites, lastUpdated, previewUrl, fileSize

Fallback when no API key:
- Allow direct add by Workshop ID.
- "Open in Workshop" link for manual discovery.
- Optional: curated local JSON list of popular mods.

Safeguards:
- Store API key only locally; rate-limit and debounce typing.

## Full settings UI (design)

Goal: Expose essentially all Ark server settings with search, categories, tooltips, validation, and presets—while preserving unknown/advanced keys.

Strategy:
- Create a declarative Settings Registry (JSON) that describes each setting:
  - id, label, description, ini: { file: GameUserSettings|Game, section, key }
  - type: string | number | boolean | select | multiselect | slider | duration | port
  - constraints: min, max, step, enum options, units
  - default, category, group, tags (for search)
- Generate forms dynamically from the registry.
- Maintain a sparse serverConfig in settingsStore; on save, merge into INIs preserving other keys and comments (where feasible).
- Provide:
  - Global search across labels/descriptions/tags
  - Categories: General, Networking, Gameplay, Rates, Difficulty, Tribe, Structures, Dino, Engrams, Mods, RCON, Logging, Performance
  - Contextual help and links to docs
  - Presets: PvE, PvP, Casual, Hardcore; Import/Export JSON profiles
  - Validation: ports ranges, numeric limits, dependencies (e.g., enabling RCON requires port)
  - Change review: show diff summary before save
  - Backup & restore INIs automatically on write

ActiveMods synchronization:
- UI order and enable/disable produce an ActiveMods comma list in GameUserSettings.ini under [ServerSettings].
- On save, update both registry-driven fields and ActiveMods together.

Advanced editors:
- Raw editors for both INIs remain available for power users.
- Edits outside the registry are preserved.

## IPC and module contracts (updated)

- mods.search(query, paging): returns { items, total, hasMore }
- mods.add(id): downloads via SteamCMD and syncs into server Mods dir
- mods.remove(id)
- mods.list(): returns installed mods with metadata and order
- mods.reorder(ids)
- config.getAll(): returns full settings object (merged from INIs)
- config.setAll(patch): validates and writes to INIs
- config.backup()/config.restore()
- server.install(dir, branch, betaPassword?)
- server.update()
- server.start(argsFromConfig)
- server.stop()
- server.status()
- steamcmd.ensureInstalled()
- updates.check(): { currentBuildId, remoteBuildId, updateAvailable }
- logs.subscribe(source): stream lines

## Detailed development plan (phased)

1) Scaffold & foundations
- Initialize Electron app, IPC bridge, settings store, UI tabs (Dashboard, Install/Update, Mods, Settings, Advanced, Logs).
- Persist global settings (paths, branch, API key, mods, serverConfig skeleton).

2) SteamCMD integration
- Auto-download/extract per OS; bootstrap update.
- Log streaming surfaced in UI.

3) Install/Update server
- Install to chosen path with branch selection (stable/beta).
- BuildId detection via app_info_print; show last check time.

4) Process control & status
- Start/Stop/Restart with arg builder from config; live status.
- Optional: query readiness via A2S; fallback to process state.

5) Mod management (ID + name search)
- Implement mods.add/remove/list/reorder; sync ActiveMods with UI order.
- Auto-update mods on start.
- Implement name search via Steam Web API; API key entry + validation; pagination and sorting.
- Fallback path: ID-only add and curated list if no key.

6) Full settings UI
- Ship initial Settings Registry covering common and advanced options (200+ entries goal).
- Build dynamic forms with categories, search, validation, and presets.
- Import/Export profile JSON; apply with preview.
- Apply/save writes to INIs (with backup) and updates process args when needed.

7) Automation & polish
- Update checks + "Update Now"; notifications.
- Log viewer filters; export logs.
- Preflight checks (ports, disk space), robust error handling, crash-safe recovery.

## Milestones & acceptance criteria

M1 Scaffold complete; settings persist and tabs render.
M2 SteamCMD auto-setup with visible logs.
M3 Install/Update server with branch selection; buildId displayed.
M4 Start/Stop/Status working reliably.
M5 Mods: add/remove/list/reorder; update-on-start; ActiveMods sync.
M6 Mod search by name with API key support; paginated results with add buttons.
M7 Full settings UI: comprehensive coverage; global search; presets; backup & restore.
M8 Update checks and UX polish; logs filtering/export.

## Risks & mitigations

- Steam API key friction: Provide clear guidance and optional path; keep ID-based flow.
- INI complexity: Use robust INI parser; maintain backups; keep advanced editor.
- Platform differences (paths/binaries): Abstract per-OS paths and signals.
- Large downloads: Parse SteamCMD output for progress; keep UI responsive.

## Notes

- AppIDs: Server 376030; Workshop app 346110.
- Binaries: Win64/ShooterGameServer.exe (Windows); ShooterGame/Binaries/Linux/ShooterGameServer (Linux).
- Ports: default UDP 7777/7778 and UDP 27015; RCON TCP when enabled.
