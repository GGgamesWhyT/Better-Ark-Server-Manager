const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');
const { ensureInstalled } = require('./steamcmdManager');

let serverProcess = null;

async function pathExists(p) { try { await fsp.access(p, fs.constants.F_OK); return true; } catch { return false; } }

function getServerExecutable(baseDir) {
  if (process.platform === 'win32') {
    return path.join(baseDir, 'ShooterGame', 'Binaries', 'Win64', 'ShooterGameServer.exe');
  } else {
    return path.join(baseDir, 'ShooterGame', 'Binaries', 'Linux', 'ShooterGameServer');
  }
}

function runSteamcmd(steamcmdBase, args) {
  return new Promise((resolve, reject) => {
    const exe = process.platform === 'win32' ? path.join(steamcmdBase, 'steamcmd.exe') : path.join(steamcmdBase, 'steamcmd.sh');
    const child = spawn(exe, args, { cwd: steamcmdBase });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(`steamcmd exited ${code}: ${stderr || stdout}`));
    });
  });
}

function quoteForceInstallDir(p) {
  // SteamCMD prefers backslashes on Windows; wrap in quotes for spaces.
  const fixed = process.platform === 'win32' ? p.replace(/\\/g, '\\') : p;
  return `"${fixed}"`;
}

async function installServer(store, targetDir, branch = 'stable', betaPassword = '') {
  if (!targetDir) throw new Error('Install directory required');
  await fsp.mkdir(targetDir, { recursive: true });
  const steam = await ensureInstalled(store);
  const args = ['+login', 'anonymous', '+force_install_dir', quoteForceInstallDir(targetDir), '+app_update', '376030'];
  if (branch && branch.toLowerCase() === 'beta') {
    args.push('-beta', 'beta');
    if (betaPassword) args.push('-betapassword', betaPassword);
  }
  args.push('validate', '+quit');
  await runSteamcmd(steam.path, args);
  // Persist server path if not set yet
  if (!store.get('serverInstallPath')) store.set('serverInstallPath', targetDir);
  return { dir: targetDir };
}

async function updateServer(store) {
  const dir = store.get('serverInstallPath');
  if (!dir) throw new Error('Set server install path first');
  const steam = await ensureInstalled(store);
  const branch = (store.get('branch') || 'stable');
  const args = ['+login', 'anonymous', '+force_install_dir', quoteForceInstallDir(dir), '+app_update', '376030'];
  if (branch && branch.toLowerCase() === 'beta') {
    args.push('-beta', 'beta');
  }
  args.push('validate', '+quit');
  await runSteamcmd(steam.path, args);
  return { dir };
}

function buildLaunchArgs(store) {
  // Minimal defaults; these will be replaced by settings later.
  const cfg = store.get('serverConfig') || {};
  const session = cfg.SessionName || 'My Ark Server';
  const port = cfg.Port || 7777;
  const queryPort = cfg.QueryPort || 27015;
  const rconEnabled = !!cfg.RCONEnabled;
  const rconPort = cfg.RCONPort || 27020;
  const map = cfg.Map || 'TheIsland';

  const firstArg = `${map}?listen?SessionName=${encodeURIComponent(session)}?Port=${port}?QueryPort=${queryPort}${rconEnabled ? `?RCONEnabled=True?RCONPort=${rconPort}` : ''}`;
  const rest = ['-server', '-log'];
  // Optional flags from cfg
  if (cfg.NoBattlEye) rest.push('-NoBattlEye');
  return { firstArg, rest };
}

function windowsKill(pid) {
  return new Promise((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
    killer.on('close', () => resolve());
    killer.on('error', () => resolve());
  });
}

async function startServer(store) {
  if (serverProcess) throw new Error('Server already running');
  const dir = store.get('serverInstallPath');
  if (!dir) throw new Error('Set server install path first');
  const exe = getServerExecutable(dir);
  if (!(await pathExists(exe))) throw new Error(`Server executable not found: ${exe}`);
  const { firstArg, rest } = buildLaunchArgs(store);
  const args = [firstArg, ...rest];
  serverProcess = spawn(exe, args, { cwd: path.dirname(exe) });
  serverProcess.on('close', () => { serverProcess = null; });
  serverProcess.on('error', () => { serverProcess = null; });
  return { pid: serverProcess.pid, args };
}

async function stopServer() {
  if (!serverProcess) return { stopped: true };
  const pid = serverProcess.pid;
  try {
    if (process.platform === 'win32') {
      await windowsKill(pid);
    } else {
      serverProcess.kill('SIGINT');
      // Small wait fallback
      await new Promise(r => setTimeout(r, 1500));
      if (serverProcess) serverProcess.kill('SIGKILL');
    }
  } finally {
    serverProcess = null;
  }
  return { pid };
}

function status() {
  return { state: serverProcess ? 'Online' : 'Offline', pid: serverProcess?.pid };
}

module.exports = { installServer, updateServer, startServer, stopServer, status };
