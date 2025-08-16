const os = require('os');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { pipeline } = require('stream/promises');
const extract = require('extract-zip');
const tar = require('tar');
const { app } = require('electron');

function getPlatform() {
  const p = process.platform;
  if (p === 'win32') return 'windows';
  if (p === 'linux') return 'linux';
  return 'unsupported';
}

function getSteamcmdUrls() {
  return {
    windows: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip',
    linux: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz'
  };
}

async function pathExists(p) {
  try { await fsp.access(p, fs.constants.F_OK); return true; } catch { return false; }
}

async function downloadToFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const fileStream = fs.createWriteStream(dest);
  await pipeline(res.body, fileStream);
  return dest;
}

async function ensureInstalled(store) {
  const platform = getPlatform();
  if (platform === 'unsupported') throw new Error('Unsupported OS for SteamCMD');
  const userData = app.getPath('userData');
  const baseDir = path.join(userData, 'steamcmd');
  const exePath = platform === 'windows'
    ? path.join(baseDir, 'steamcmd.exe')
    : path.join(baseDir, 'steamcmd.sh');

  if (await pathExists(exePath)) {
    if (store && !store.get('steamcmdPath')) store.set('steamcmdPath', baseDir);
    return { path: baseDir, exe: exePath, installed: true };
  }

  const urls = getSteamcmdUrls();
  await fsp.mkdir(baseDir, { recursive: true });

  if (platform === 'windows') {
    const zipPath = path.join(os.tmpdir(), 'steamcmd.zip');
    await downloadToFile(urls.windows, zipPath);
    await extract(zipPath, { dir: baseDir });
  } else if (platform === 'linux') {
    const tarPath = path.join(os.tmpdir(), 'steamcmd_linux.tar.gz');
    await downloadToFile(urls.linux, tarPath);
    await tar.x({ file: tarPath, cwd: baseDir, gzip: true });
    // ensure script is executable
    try { await fsp.chmod(path.join(baseDir, 'steamcmd.sh'), 0o755); } catch {}
  }

  if (store) store.set('steamcmdPath', baseDir);
  return { path: baseDir, exe: exePath, installed: true };
}

module.exports = { ensureInstalled };
