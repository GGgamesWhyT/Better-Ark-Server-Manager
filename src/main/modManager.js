const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');
const { ensureInstalled } = require('./steamcmdManager');
const ini = require('ini');
const progress = require('./progressBus');
const logs = require('./logBus');
const { startTail } = require('./logTailer');
const { parseAndEmit } = require('./steamcmdProgress');
const tasks = require('./taskRegistry');

async function pathExists(p) {
  try { await fsp.access(p, fs.constants.F_OK); return true; } catch { return false; }
}

function getServerModsDir(serverInstallPath) {
  return path.join(serverInstallPath, 'ShooterGame', 'Content', 'Mods');
}

function runSteamcmd(steamcmdBase, args, taskId, retries = 1) {
  return new Promise((resolve, reject) => {
    const exe = process.platform === 'win32' ? path.join(steamcmdBase, 'steamcmd.exe') : path.join(steamcmdBase, 'steamcmd.sh');
    const child = spawn(exe, args, { cwd: steamcmdBase });
  if (taskId) tasks.register(taskId, child);
    let stdout = '';
    let stderr = '';
    const parse = (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (taskId) parseAndEmit(taskId, text);
    };
  child.stdout.on('data', (d) => { const t = String(d).replace(/\r/g, '\n'); logs.emit('steamcmd', t); parse(d); });
  child.stderr.on('data', (d) => { const t = String(d).replace(/\r/g, '\n'); stderr += t; logs.emit('steamcmd', t); if (taskId) progress.emit(taskId, { type: 'message', message: t.trim() }); });
    child.on('error', (err) => { if (taskId) progress.emit(taskId, { type: 'error', message: String(err) }); reject(err); });
    child.on('close', code => {
      if (taskId && tasks.isCanceled(taskId)) {
        if (taskId) progress.emit(taskId, { type: 'done', code: 'canceled' });
        tasks.consumeCanceled(taskId);
        return resolve({ code: 'canceled', stdout, stderr });
      }
      if (taskId) progress.emit(taskId, { type: 'done', code });
      if (code === 0) return resolve({ code, stdout, stderr });
      if (code === 8 && retries > 0) {
        if (taskId && tasks.isCanceled(taskId)) {
          if (taskId) progress.emit(taskId, { type: 'done', code: 'canceled' });
          tasks.consumeCanceled(taskId);
          return resolve({ code: 'canceled', stdout, stderr });
        }
        logs.emit('steamcmd', 'SteamCMD exited 8 (likely self-update). Retrying once...\n');
        if (taskId) progress.emit(taskId, { type: 'message', message: 'SteamCMD updated; retrying...' });
        return resolve(runSteamcmd(steamcmdBase, args, taskId, retries - 1));
      }
      return reject(new Error(`steamcmd exited ${code}: ${stderr || stdout}`));
    });
  });
}

async function ensureServerModsDir(serverInstallPath) {
  const modsDir = getServerModsDir(serverInstallPath);
  await fsp.mkdir(modsDir, { recursive: true });
  return modsDir;
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isSymbolicLink()) {
      const real = await fsp.realpath(s);
      await fsp.symlink(real, d);
    } else {
      await fsp.copyFile(s, d);
    }
  }
}

async function findModDescriptor(startDir, modId) {
  const direct = path.join(startDir, `${modId}.mod`);
  if (await pathExists(direct)) return direct;
  const folderCandidate = path.join(startDir, String(modId), `${modId}.mod`);
  if (await pathExists(folderCandidate)) return folderCandidate;
  const root = path.join(startDir, String(modId));
  if (!(await pathExists(root))) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.mod')) return full;
    }
  }
  return null;
}

async function addModById(store, modId) {
  if (!/^\d+$/.test(String(modId))) throw new Error('Invalid mod ID');
  const serverInstallPath = store.get('serverInstallPath');
  if (!serverInstallPath) throw new Error('Set server install path first');
  const steam = await ensureInstalled(store);
  const args = ['+login', 'anonymous', '+workshop_download_item', '346110', String(modId), 'validate', '+quit'];
  let stopTail;
  if (process.platform === 'win32') {
    const logDir = path.join(steam.path, 'logs');
  stopTail = startTail([logDir], (chunk) => { const t = String(chunk).replace(/\r/g, '\n'); logs.emit('steamcmd', t); parseAndEmit(`mod:${modId}`, t); });
  tasks.addCleanup(`mod:${modId}`, stopTail);
  }
  try {
  const res = await runSteamcmd(steam.path, args, `mod:${modId}`);
  if (res && res.code === 'canceled') return { canceled: true };
  } finally {
    if (stopTail) stopTail();
  }
  const workshopRoot = path.join(steam.path, 'steamapps', 'workshop', 'content', '346110');
  const modFolder = path.join(workshopRoot, String(modId));
  if (!(await pathExists(modFolder))) throw new Error(`Downloaded mod folder not found: ${modFolder}`);
  const serverModsDir = await ensureServerModsDir(serverInstallPath);
  const destFolder = path.join(serverModsDir, String(modId));
  await copyDir(modFolder, destFolder);
  const descriptor = await findModDescriptor(workshopRoot, modId);
  if (descriptor) {
    await fsp.copyFile(descriptor, path.join(serverModsDir, `${modId}.mod`));
  } else {
    console.warn(`.mod descriptor not found for ${modId}. The server will generate it on first run.`);
  }
  const mods = store.get('mods') || [];
  if (!mods.find(m => String(m.id) === String(modId))) {
    mods.push({ id: String(modId), enabled: true });
    store.set('mods', mods);
  }
  return { id: String(modId) };
}

async function listInstalledMods(store) {
  const serverInstallPath = store.get('serverInstallPath');
  if (!serverInstallPath) return [];
  const modsDir = getServerModsDir(serverInstallPath);
  const mods = [];
  try {
    const entries = await fsp.readdir(modsDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && /^\d+$/.test(e.name)) {
        const id = e.name;
        const hasModFile = await pathExists(path.join(modsDir, `${id}.mod`));
        mods.push({ id, hasModFile });
      }
    }
  } catch { }
  return mods;
}

async function removeMod(store, modId) {
  const serverInstallPath = store.get('serverInstallPath');
  if (!serverInstallPath) throw new Error('Set server install path first');
  const modsDir = getServerModsDir(serverInstallPath);
  const dir = path.join(modsDir, String(modId));
  const modFile = path.join(modsDir, `${modId}.mod`);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.rm(modFile, { force: true });
  const mods = (store.get('mods') || []).filter(m => String(m.id) !== String(modId));
  store.set('mods', mods);
  return { id: String(modId) };
}

async function getModsState(store) {
  const installed = await listInstalledMods(store);
  const state = store.get('mods') || [];
  const known = new Set(state.map(m => String(m.id)));
  const merged = [...state.map(m => ({ id: String(m.id), enabled: !!m.enabled }))];
  installed.forEach(im => {
    if (!known.has(String(im.id))) merged.push({ id: String(im.id), enabled: false });
  });
  return merged;
}

async function setModsState(store, newState) {
  const normalized = (newState || [])
    .filter(m => m && /^\d+$/.test(String(m.id)))
    .map(m => ({ id: String(m.id), enabled: !!m.enabled }));
  store.set('mods', normalized);
  return normalized;
}

function resolveGameUserSettingsPath(serverInstallPath) {
  const base = path.join(serverInstallPath, 'ShooterGame', 'Saved', 'Config');
  const candidates = [
    path.join(base, 'WindowsServer', 'GameUserSettings.ini'),
    path.join(base, 'LinuxServer', 'GameUserSettings.ini')
  ];
  return candidates;
}

async function writeActiveMods(store) {
  const serverInstallPath = store.get('serverInstallPath');
  if (!serverInstallPath) throw new Error('Set server install path first');
  const modsState = await getModsState(store);
  const activeIds = modsState.filter(m => m.enabled).map(m => m.id);
  const candidates = resolveGameUserSettingsPath(serverInstallPath);
  let iniPath = null;
  for (const c of candidates) { if (await pathExists(c)) { iniPath = c; break; } }
  if (!iniPath) {
    const target = process.platform === 'win32' ? candidates[0] : candidates[1];
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, '[ServerSettings]\n');
    iniPath = target;
  }
  const raw = await fsp.readFile(iniPath, 'utf-8');
  const parsed = ini.parse(raw);
  if (!parsed.ServerSettings) parsed.ServerSettings = {};
  parsed.ServerSettings.ActiveMods = activeIds.join(',');
  try { await fsp.copyFile(iniPath, `${iniPath}.bak`); } catch {}
  const serialized = ini.encode(parsed, { whitespace: true });
  await fsp.writeFile(iniPath, serialized, 'utf-8');
  return { iniPath, activeMods: parsed.ServerSettings.ActiveMods };
}

module.exports = { addModById, listInstalledMods, removeMod, getModsState, setModsState, writeActiveMods };
