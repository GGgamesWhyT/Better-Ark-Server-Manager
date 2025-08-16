const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');
const { ensureInstalled } = require('./steamcmdManager');

async function pathExists(p) { try { await fsp.access(p, fs.constants.F_OK); return true; } catch { return false; } }

async function readCurrentBuildId(steamBase) {
  const manifest = path.join(steamBase, 'steamapps', 'appmanifest_376030.acf');
  if (!(await pathExists(manifest))) return null;
  const text = await fsp.readFile(manifest, 'utf-8');
  const m = text.match(/"buildid"\s*"(\d+)"/i);
  return m ? m[1] : null;
}

function runSteamcmd(steamBase, args) {
  return new Promise((resolve, _reject) => {
    const exe = process.platform === 'win32' ? path.join(steamBase, 'steamcmd.exe') : path.join(steamBase, 'steamcmd.sh');
    const child = spawn(exe, args, { cwd: steamBase });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (_code) => {
      resolve({ stdout, stderr });
    });
  });
}

function parseRemoteBuildId(appInfoText) {
  let m;
  const publicSection = appInfoText.split(/\n/).reduce((acc, line) => {
    const l = line.trim();
    if (/^"branches"/i.test(l)) acc.inBranches = true;
    if (acc.inBranches && /^"public"/i.test(l)) acc.inPublic = true;
    if (acc.inPublic && /"buildid"\s*"(\d+)"/i.test(l)) acc.buildid = l.match(/"buildid"\s*"(\d+)"/i)[1];
    if (acc.inBranches && /^}/.test(l)) { acc.inBranches = false; acc.inPublic = false; }
    return acc;
  }, { inBranches: false, inPublic: false, buildid: null });
  if (publicSection.buildid) return publicSection.buildid;
  m = appInfoText.match(/"buildid"\s*"(\d+)"/i);
  return m ? m[1] : null;
}

async function checkForUpdates(store) {
  const steam = await ensureInstalled(store);
  const currentBuildId = await readCurrentBuildId(steam.path);
  const { stdout } = await runSteamcmd(steam.path, ['+login', 'anonymous', '+app_info_update', '1', '+app_info_print', '376030', '+quit']);
  const remoteBuildId = parseRemoteBuildId(stdout || '');
  const updateAvailable = currentBuildId && remoteBuildId && currentBuildId !== remoteBuildId;
  return { currentBuildId, remoteBuildId, updateAvailable: !!updateAvailable };
}

module.exports = { checkForUpdates };
