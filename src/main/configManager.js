const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const ini = require('ini');

async function pathExists(p) { try { await fsp.access(p, fs.constants.F_OK); return true; } catch { return false; } }

function resolveGameUserSettingsPath(serverInstallPath) {
  const base = path.join(serverInstallPath, 'ShooterGame', 'Saved', 'Config');
  return [
    path.join(base, 'WindowsServer', 'GameUserSettings.ini'),
    path.join(base, 'LinuxServer', 'GameUserSettings.ini')
  ];
}

async function writeServerSettingsINI(serverInstallPath, cfg) {
  if (!serverInstallPath) return { iniPath: null };
  const candidates = resolveGameUserSettingsPath(serverInstallPath);
  let iniPath = null;
  for (const c of candidates) { if (await pathExists(c)) { iniPath = c; break; } }
  if (!iniPath) {
    // Create default on the platform-specific path
    iniPath = candidates[0];
    await fsp.mkdir(path.dirname(iniPath), { recursive: true });
    await fsp.writeFile(iniPath, '[ServerSettings]\n');
  }
  const raw = await fsp.readFile(iniPath, 'utf-8');
  const parsed = ini.parse(raw);
  if (!parsed.ServerSettings) parsed.ServerSettings = {};
  const SS = parsed.ServerSettings;

  if (typeof cfg.SessionName === 'string') SS.SessionName = cfg.SessionName;
  if (cfg.Port != null) SS.Port = Number(cfg.Port);
  if (cfg.QueryPort != null) SS.QueryPort = Number(cfg.QueryPort);
  if (cfg.RCONEnabled != null) SS.RCONEnabled = cfg.RCONEnabled ? 'True' : 'False';
  if (cfg.RCONPort != null) SS.RCONPort = Number(cfg.RCONPort);

  try { await fsp.copyFile(iniPath, `${iniPath}.bak`); } catch {}
  const serialized = ini.encode(parsed, { whitespace: true });
  await fsp.writeFile(iniPath, serialized, 'utf-8');
  return { iniPath };
}

function getDefaults() {
  return {
    Map: 'TheIsland',
    SessionName: 'My Ark Server',
    Port: 7777,
    QueryPort: 27015,
    RCONEnabled: false,
    RCONPort: 27020,
  };
}

async function getServerConfig(store) {
  const cfg = store.get('serverConfig') || {};
  return { ...getDefaults(), ...cfg };
}

async function setServerConfig(store, patch) {
  const current = await getServerConfig(store);
  const next = { ...current, ...patch };
  store.set('serverConfig', next);
  const serverInstallPath = store.get('serverInstallPath');
  let iniPath = null;
  if (serverInstallPath) {
    const res = await writeServerSettingsINI(serverInstallPath, next);
    iniPath = res.iniPath;
  }
  return { config: next, iniPath };
}

module.exports = { getServerConfig, setServerConfig };
