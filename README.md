# Better Ark Server Manager

Cross-platform (Windows & Linux) Electron-based manager for Ark: Survival Evolved dedicated servers.

Current status (alpha):
- Implemented
	- One-click SteamCMD setup and server install/update
	- Branch selection (stable/beta)
	- Start/Stop with live status indicator and streaming logs
	- Mods by Workshop ID: add/remove/list/reorder; enable/disable; write ActiveMods to GameUserSettings.ini
	- Live progress bars for installs/updates and mod downloads, including speed/ETA
	- Cancel running installs/updates and current mod download
	- Windows-friendly log tailing to mitigate SteamCMD stdout buffering
- Planned
	- Full settings UI exposing Ark server options (no manual INI editing required)
	- Advanced raw editors for GameUserSettings.ini and Game.ini
	- Optional per-task queue view with individual cancel

See the project plan in docs/PLANNING.md for details, progress, and milestones.
