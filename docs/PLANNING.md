# Better Ark Server Manager — Planning

Last updated: 2025-08-16

## Scope update

Change: Remove Steam Workshop name search and Steam Web API usage. Mods are managed by Workshop ID only (paste ID); no API key needed.

## Requirements checklist

- SteamCMD auto-install and management (Windows/Linux)
- One-click Ark server installation to a chosen directory
- Branch selection: stable (default) and beta
- Start/Stop/Restart server; show status (Online/Offline/Updating)
- Mods by ID only: add/remove/list/reorder; auto-update mods on start
- Full settings UI (no manual INI edits required) with advanced INI editors still available
- Server update checks and "Update Now" button
- Clear logs and status from server and SteamCMD

## Architecture overview

- Electron main process: lifecycle, IPC, process mgmt, filesystem, SteamCMD integration
- Preload: secure IPC bridge
- Renderer: HTML/CSS/JS UI (no heavy framework initially)
- Services (Node in main):
  - steamcmdManager: download/update/run scripts, branch selection
  - serverManager: install/update/start/stop/status; args builder
  - modManager: add/remove/reorder by ID, update on start
  - configManager: read/write INIs; settings registry mapping <-> UI
  - logManager: stream + persist logs
  - settingsStore: persisted JSON (paths, branch, mods, server config)

No external Steam Web API dependency.

## Mod management by ID (design)

- Add by ID: Use SteamCMD `workshop_download_item 346110 <modId> validate` to download/update.
- Sync to server: Copy from Steam workshop cache to `ShooterGame/Content/Mods` and ensure `.mod` file present.
- List installed mods: Scan server Mods directory; persist order in settingsStore.
- Reorder: Drag-and-drop; serialize to `ActiveMods` comma list in GameUserSettings.ini.
- Remove: Delete from server Mods directory (optionally leave workshop cache intact).
- Auto-update on start: For enabled mods, run `workshop_download_item ...` before launching server.

## Full settings UI (design)

- Declarative Settings Registry (JSON) defines fields, types, constraints, and INI mapping.
- Generated forms with categories, search, validation, presets; INI backup/merge on save.
- Advanced raw INI editors remain available.

## IPC and module contracts (updated)

- mods.add(id): download via SteamCMD and sync into server Mods dir
- mods.remove(id)
- mods.list(): return installed mods with metadata and order
- mods.reorder(ids)
- config.getAll()/config.setAll(patch)
- config.backup()/config.restore()
- server.install(dir, branch, betaPassword?)
- server.update()
- server.start(argsFromConfig)
- server.stop()
- server.status()
- steamcmd.ensureInstalled()
- updates.check(): { currentBuildId, remoteBuildId, updateAvailable }
- logs.subscribe(source)

## Detailed development plan (phased)

1) Scaffold & foundations
2) SteamCMD integration
3) Install/Update server
4) Process control & status
5) Mod management (by ID only): add/remove/list/reorder; update-on-start; ActiveMods sync
6) Full settings UI (registry-driven) with advanced editors
7) Automation & polish (update checks, logs, preflight checks)

## Milestones & acceptance criteria

M1 Scaffold complete; settings persist and tabs render.
M2 SteamCMD auto-setup with visible logs.
M3 Install/Update server with branch selection; buildId displayed.
M4 Start/Stop/Status working reliably.
M5 Mods by ID: add/remove/list/reorder; update-on-start; ActiveMods sync.
M6 Full settings UI shipped; backup & restore.
M7 Update checks and UX polish; logs filtering/export.

## Risks & mitigations

- INI complexity: Use robust parser and backups; keep advanced editor.
- Platform path differences: Abstract per-OS paths and signals.
- Large downloads: Parse SteamCMD output for progress; keep UI responsive.

## Notes

- AppIDs: Server 376030; Workshop app 346110.
- Binaries: Win64/ShooterGameServer.exe (Windows); ShooterGame/Binaries/Linux/ShooterGameServer (Linux).
- Ports: default UDP 7777/7778 and UDP 27015; RCON TCP when enabled.
