// Simple tab navigation
const tabButtons = document.querySelectorAll('.tabs button');
const tabs = document.querySelectorAll('.tab');

tabButtons.forEach(btn => btn.addEventListener('click', () => {
  tabButtons.forEach(b => b.classList.remove('active'));
  tabs.forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(btn.dataset.tab).classList.add('active');
}));

// Load settings
let cachedSettings = {};
(async function init() {
  cachedSettings = await window.api.settings.get();
  const steamcmdPathEl = document.getElementById('steamcmdPath');
  if (steamcmdPathEl && cachedSettings.steamcmdPath) {
    steamcmdPathEl.textContent = `SteamCMD at: ${cachedSettings.steamcmdPath}`;
  }
  const installPathEl = document.getElementById('installPath');
  if (installPathEl && cachedSettings.serverInstallPath) {
    installPathEl.value = cachedSettings.serverInstallPath;
  }
  const branchSel = document.getElementById('branch');
  if (branchSel) {
    branchSel.value = cachedSettings.branch || 'stable';
  }
  await refreshModsList();
  await renderModsState();
  await refreshServerStatus();
  startStatusPolling();
  setupProgressHandlers();
  setupLogs();
})();

// Ensure SteamCMD
const ensureBtn = document.getElementById('ensureSteamcmd');
if (ensureBtn) {
  ensureBtn.addEventListener('click', async () => {
    ensureBtn.disabled = true;
    ensureBtn.textContent = 'Installing...';
    try {
      const res = await window.api.steamcmd.ensure();
      const steamcmdPathEl = document.getElementById('steamcmdPath');
      if (steamcmdPathEl) steamcmdPathEl.textContent = `SteamCMD at: ${res.path}`;
      alert('SteamCMD is installed and ready.');
    } catch (e) {
      alert('Failed to install SteamCMD: ' + (e?.message || e));
    } finally {
      ensureBtn.disabled = false;
      ensureBtn.textContent = 'Install/Verify SteamCMD';
    }
  });
}

// Install path browse/save
const browseBtn = document.getElementById('browseInstallPath');
const savePathBtn = document.getElementById('saveInstallPath');
const installPathEl = document.getElementById('installPath');
const branchSel = document.getElementById('branch');

if (browseBtn && installPathEl) {
  browseBtn.addEventListener('click', async () => {
    const p = await window.api.system.chooseDirectory();
    if (p) installPathEl.value = p;
  });
}
if (savePathBtn && installPathEl) {
  savePathBtn.addEventListener('click', async () => {
    const p = (installPathEl.value || '').trim();
    if (!p) { alert('Please choose a server install path.'); return; }
    const patch = { serverInstallPath: p };
    if (branchSel) patch.branch = branchSel.value;
    cachedSettings = await window.api.settings.set(patch);
    alert('Saved server install path and branch.');
  });
}
if (branchSel) {
  branchSel.addEventListener('change', async () => {
    cachedSettings = await window.api.settings.set({ branch: branchSel.value });
  });
}

async function ensureServerPath() {
  cachedSettings = await window.api.settings.get();
  if (!cachedSettings.serverInstallPath) {
    throw new Error('Set server install path in Install/Update tab first.');
  }
}

// Server controls
const installServerBtn = document.getElementById('installServerBtn');
const updateServerBtn = document.getElementById('updateServerBtn');
const startServerBtn = document.getElementById('startServerBtn');
const stopServerBtn = document.getElementById('stopServerBtn');
const serverStatusEl = document.getElementById('serverStatus');
const serverStatusPill = document.getElementById('serverStatusPill');

async function refreshServerStatus() {
  if (!serverStatusEl) return;
  try {
    const st = await window.api.server.status();
    serverStatusEl.textContent = `Status: ${st.state}${st.pid ? ` (PID ${st.pid})` : ''}`;
    if (serverStatusPill) {
      serverStatusPill.textContent = st.state;
      serverStatusPill.classList.remove('online','offline','unknown');
      if (st.state === 'Online') serverStatusPill.classList.add('online');
      else if (st.state === 'Offline') serverStatusPill.classList.add('offline');
      else serverStatusPill.classList.add('unknown');
    }
    if (startServerBtn && stopServerBtn) {
      const running = st.state === 'Online';
      startServerBtn.disabled = running;
      stopServerBtn.disabled = !running;
    }
  } catch { serverStatusEl.textContent = 'Status: Unknown'; }
}

let statusTimer;
function startStatusPolling() {
  if (statusTimer) clearInterval(statusTimer);
  statusTimer = setInterval(refreshServerStatus, 3000);
}

if (installServerBtn) {
  installServerBtn.addEventListener('click', async () => {
    try {
      const dir = (installPathEl.value || '').trim();
      if (!dir) { alert('Please set install path.'); return; }
      installServerBtn.disabled = true;
      installServerBtn.textContent = 'Installing...';
      startInstallUI();
      const res = await window.api.server.install(dir, branchSel ? branchSel.value : 'stable');
      if (res && res.canceled) return; // canceled by user
      alert('Server installed/updated.');
    } catch (e) {
      alert('Install failed: ' + (e?.message || e));
    } finally {
      installServerBtn.disabled = false;
      installServerBtn.textContent = 'Install';
      await refreshServerStatus();
      finishInstallUI();
    }
  });
}

if (updateServerBtn) {
  updateServerBtn.addEventListener('click', async () => {
    try {
      await ensureServerPath();
      updateServerBtn.disabled = true;
      updateServerBtn.textContent = 'Updating...';
      startInstallUI();
      const res = await window.api.server.update();
      if (res && res.canceled) return; // canceled by user
      alert('Server updated.');
    } catch (e) {
      alert('Update failed: ' + (e?.message || e));
    } finally {
      updateServerBtn.disabled = false;
      updateServerBtn.textContent = 'Update Now';
      await refreshServerStatus();
      finishInstallUI();
    }
  });
}

if (startServerBtn) {
  startServerBtn.addEventListener('click', async () => {
    try {
      await ensureServerPath();
      startServerBtn.disabled = true;
      startServerBtn.textContent = 'Starting...';
      await window.api.server.start();
      await refreshServerStatus();
    } catch (e) {
      alert('Start failed: ' + (e?.message || e));
    } finally {
      startServerBtn.disabled = false;
      startServerBtn.textContent = 'Start Server';
    }
  });
}

if (stopServerBtn) {
  stopServerBtn.addEventListener('click', async () => {
    try {
      stopServerBtn.disabled = true;
      stopServerBtn.textContent = 'Stopping...';
      await window.api.server.stop();
      await refreshServerStatus();
    } catch (e) {
      alert('Stop failed: ' + (e?.message || e));
    } finally {
      stopServerBtn.disabled = false;
      stopServerBtn.textContent = 'Stop Server';
    }
  });
}

// Mods: add by ID (existing)
const addByIdBtn = document.getElementById('addModById');
const modIdInput = document.getElementById('modIdInput');
if (addByIdBtn && modIdInput) {
  addByIdBtn.addEventListener('click', async () => {
    try {
      await ensureServerPath();
      const id = (modIdInput.value || '').trim();
      if (!/^\d+$/.test(id)) {
        alert('Please enter a valid numeric Workshop ID.');
        return;
      }
      addByIdBtn.disabled = true;
      addByIdBtn.textContent = 'Downloading...';
      currentModTaskId = `mod:${id}`;
      startModUI();
      const res = await window.api.mods.addById(id);
      if (!(res && res.canceled)) {
        await refreshModsList();
        await renderModsState();
        alert('Mod added.');
      }
    } catch (e) {
      alert('Failed to add mod: ' + (e?.message || e));
    } finally {
      addByIdBtn.disabled = false;
      addByIdBtn.textContent = 'Add Mod by ID';
      finishModUI();
    }
  });
}

async function refreshModsList() {
  const listEl = document.getElementById('installedMods');
  if (!listEl) return;
  listEl.innerHTML = 'Loading...';
  try {
    const mods = await window.api.mods.list();
    if (!mods.length) { listEl.innerHTML = '<em>No mods installed yet.</em>'; return; }
    listEl.innerHTML = '';
    mods.forEach(m => {
      const div = document.createElement('div');
      div.className = 'result';
      div.innerHTML = `
        <span><strong>${m.id}</strong> ${m.hasModFile ? '' : '<small>(.mod missing)</small>'}</span>
        <button data-id="${m.id}" class="remove">Remove</button>
      `;
      div.querySelector('button.remove').addEventListener('click', async () => {
        if (confirm(`Remove mod ${m.id}?`)) {
          try {
            await window.api.mods.remove(m.id);
            await refreshModsList();
            await renderModsState();
          } catch (e) {
            alert('Failed to remove: ' + (e?.message || e));
          }
        }
      });
      listEl.appendChild(div);
    });
  } catch (e) {
    listEl.innerHTML = '<em>Failed to list mods.</em>';
  }
}

async function renderModsState() {
  const container = document.getElementById('modsState');
  if (!container) return;
  container.innerHTML = 'Loading...';
  const state = await window.api.mods.getState();
  if (!state.length) { container.innerHTML = '<em>No mods to manage.</em>'; return; }
  container.innerHTML = '';

  function redraw() {
    container.innerHTML = '';
    current.forEach((m, idx) => {
      const row = document.createElement('div');
      row.className = 'result';
    row.innerHTML = `
        <span>
          <input type="checkbox" ${m.enabled ? 'checked' : ''} data-idx="${idx}" class="toggle" />
          <strong>${m.id}</strong>
        </span>
        <span>
      <button class="up icon-btn" data-idx="${idx}" title="Move up">▲</button>
      <button class="down icon-btn" data-idx="${idx}" title="Move down">▼</button>
        </span>
      `;
      row.querySelector('.toggle').addEventListener('change', (e) => {
        current[idx].enabled = e.target.checked;
      });
      row.querySelector('.up').addEventListener('click', () => {
        if (idx > 0) { const t = current[idx-1]; current[idx-1] = current[idx]; current[idx] = t; redraw(); }
      });
      row.querySelector('.down').addEventListener('click', () => {
        if (idx < current.length - 1) { const t = current[idx+1]; current[idx+1] = current[idx]; current[idx] = t; redraw(); }
      });
      container.appendChild(row);
    });
  }

  let current = state.slice();
  redraw();

  const saveBtn = document.getElementById('saveActiveMods');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        await window.api.mods.setState(current);
        const res = await window.api.mods.writeActiveMods();
        alert(`ActiveMods saved to INI: ${res.activeMods}`);
      } catch (e) {
        alert('Failed to write ActiveMods: ' + (e?.message || e));
      }
    };
  }
}

// Progress bars
const installProgress = document.getElementById('installProgress');
const installProgressMsg = document.getElementById('installProgressMsg');
const modProgress = document.getElementById('modProgress');
const modProgressMsg = document.getElementById('modProgressMsg');
const installProgressRow = document.getElementById('installProgressRow');
const modProgressRow = document.getElementById('modProgressRow');
const installSpeedEta = document.getElementById('installSpeedEta');
const modSpeedEta = document.getElementById('modSpeedEta');
const cancelInstallBtn = document.getElementById('cancelInstall');
const cancelModBtn = document.getElementById('cancelMod');

function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

function resetInstallProgress() {
  if (installProgress) installProgress.value = 0;
  if (installProgressMsg) installProgressMsg.textContent = '';
  if (installSpeedEta) { installSpeedEta.textContent = ''; hide(installSpeedEta); }
}
function resetModProgress() {
  if (modProgress) modProgress.value = 0;
  if (modProgressMsg) modProgressMsg.textContent = '';
  if (modSpeedEta) { modSpeedEta.textContent = ''; hide(modSpeedEta); }
}

// Show progress rows only when active
function startInstallUI() { resetInstallProgress(); show(installProgressRow); }
function finishInstallUI() { hide(installProgressRow); resetInstallProgress(); }
function startModUI() { resetModProgress(); show(modProgressRow); }
function finishModUI() { hide(modProgressRow); resetModProgress(); }

// Update speed/ETA badge
function setSpeedEta(which, text) {
  if (which === 'install') { if (installSpeedEta) { installSpeedEta.textContent = text; if (text) show(installSpeedEta); else hide(installSpeedEta); } }
  if (which === 'mod') { if (modSpeedEta) { modSpeedEta.textContent = text; if (text) show(modSpeedEta); else hide(modSpeedEta); } }
}

// Adjust button handlers to toggle visibility
if (installServerBtn) {
  installServerBtn.addEventListener('click', async () => {
    try {
      const dir = (installPathEl.value || '').trim();
      if (!dir) { alert('Please set install path.'); return; }
      installServerBtn.disabled = true;
      installServerBtn.textContent = 'Installing...';
      startInstallUI();
      const res = await window.api.server.install(dir, branchSel ? branchSel.value : 'stable');
      if (res && res.canceled) return; // canceled by user
      alert('Server installed/updated.');
    } catch (e) {
      alert('Install failed: ' + (e?.message || e));
    } finally {
      installServerBtn.disabled = false;
      installServerBtn.textContent = 'Install';
      await refreshServerStatus();
      finishInstallUI();
    }
  });
}

if (updateServerBtn) {
  updateServerBtn.addEventListener('click', async () => {
    try {
      await ensureServerPath();
      updateServerBtn.disabled = true;
      updateServerBtn.textContent = 'Updating...';
      startInstallUI();
      const res = await window.api.server.update();
      if (res && res.canceled) return; // canceled by user
      alert('Server updated.');
    } catch (e) {
      alert('Update failed: ' + (e?.message || e));
    } finally {
      updateServerBtn.disabled = false;
      updateServerBtn.textContent = 'Update Now';
      await refreshServerStatus();
      finishInstallUI();
    }
  });
}

if (cancelInstallBtn) {
  cancelInstallBtn.onclick = async () => {
    await window.api.tasks.cancel('server:install');
    await window.api.tasks.cancel('server:update');
    finishInstallUI();
  };
}

if (addByIdBtn && modIdInput) {
  addByIdBtn.addEventListener('click', async () => {
    try {
      await ensureServerPath();
      const id = (modIdInput.value || '').trim();
      if (!/^\d+$/.test(id)) { alert('Please enter a valid numeric Workshop ID.'); return; }
      addByIdBtn.disabled = true;
      addByIdBtn.textContent = 'Downloading...';
      currentModTaskId = `mod:${id}`;
      startModUI();
      const res = await window.api.mods.addById(id);
      if (!(res && res.canceled)) {
        await refreshModsList();
        await renderModsState();
        alert('Mod added.');
      }
    } catch (e) {
      alert('Failed to add mod: ' + (e?.message || e));
    } finally {
      addByIdBtn.disabled = false;
      addByIdBtn.textContent = 'Add Mod by ID';
      finishModUI();
    }
  });
}

if (cancelModBtn) {
  cancelModBtn.onclick = async () => {
    const id = currentModTaskId || 'mod:current';
    await window.api.tasks.cancel(id);
    finishModUI();
  };
}

// Integrate speed/ETA into progress messages
function updateSpeedEta(which, msgEl, msg) {
  const bytes = parseBytesFromMessage(msg);
  const now = Date.now();
  if (!bytes) { setSpeedEta(which, ''); return; }
  if (which === 'install') {
    if (lastInstallSample && lastInstallSample.total === bytes.total) {
      const dt = (now - lastInstallSample.time) / 1000;
      const db = bytes.done - lastInstallSample.bytes;
      const bps = db / Math.max(dt, 0.001);
      const eta = formatETA(bytes.total - bytes.done, bps);
      const speed = formatSpeedBps(bps);
      setSpeedEta('install', `${speed}${eta ? ` • ETA ${eta}` : ''}`);
      lastInstallSample = { time: now, bytes: bytes.done, total: bytes.total };
      return;
    }
    lastInstallSample = { time: now, bytes: bytes.done, total: bytes.total };
  } else if (which === 'mod') {
    if (lastModSample && lastModSample.total === bytes.total) {
      const dt = (now - lastModSample.time) / 1000;
      const db = bytes.done - lastModSample.bytes;
      const bps = db / Math.max(dt, 0.001);
      const eta = formatETA(bytes.total - bytes.done, bps);
      const speed = formatSpeedBps(bps);
      setSpeedEta('mod', `${speed}${eta ? ` • ETA ${eta}` : ''}`);
      lastModSample = { time: now, bytes: bytes.done, total: bytes.total };
      return;
    }
    lastModSample = { time: now, bytes: bytes.done, total: bytes.total };
  }
}

// Progress events -> update UI and speed/eta
function setupProgressHandlers() {
  if (!window.api.progress?.onUpdate) return;
  window.api.progress.onUpdate(({ taskId, type, percent, message }) => {
    if (taskId === 'server:install' || taskId === 'server:update') {
      show(installProgressRow);
      if (type === 'progress' && installProgress && typeof percent === 'number') installProgress.value = percent;
      if (message && installProgressMsg) { installProgressMsg.textContent = message; updateSpeedEta('install', installProgressMsg, message); }
      if (type === 'done') finishInstallUI();
    } else if (typeof taskId === 'string' && taskId.startsWith('mod:')) {
      show(modProgressRow);
      if (type === 'progress' && modProgress && typeof percent === 'number') modProgress.value = percent;
      if (message && modProgressMsg) { modProgressMsg.textContent = message; updateSpeedEta('mod', modProgressMsg, message); }
      if (type === 'done') finishModUI();
    }
  });
}

// Logs batching to keep UI smooth
const logsOutput = document.getElementById('logsOutput');
const clearLogsBtn = document.getElementById('clearLogs');
let logQueue = [];
let logFlushTimer = null;
function setupLogs() {
  if (!window.api.logs?.onAppend || !logsOutput) return;
  const scheduleFlush = () => {
    if (logFlushTimer) return;
    logFlushTimer = setInterval(() => {
      if (!logQueue.length) return;
      const batch = logQueue.join('');
      logQueue = [];
      const nearBottom = (logsOutput.scrollHeight - logsOutput.scrollTop - logsOutput.clientHeight) < 50;
      logsOutput.insertAdjacentText('beforeend', batch);
      const maxChars = 200000;
      if (logsOutput.textContent.length > maxChars) {
        logsOutput.textContent = logsOutput.textContent.slice(-maxChars);
      }
      if (nearBottom) logsOutput.scrollTop = logsOutput.scrollHeight;
    }, 100);
  };
  window.api.logs.onAppend(({ source, message }) => {
    const prefix = source === 'steamcmd' ? '[SteamCMD] ' : '[Server] ';
    const text = message.endsWith('\n') ? message : message + '\n';
    logQueue.push(prefix + text);
    scheduleFlush();
  });
  if (clearLogsBtn && logsOutput) {
    clearLogsBtn.onclick = () => { logsOutput.textContent = ''; };
  }
}

// Settings form wiring
const cfgMap = document.getElementById('cfgMap');
const cfgSessionName = document.getElementById('cfgSessionName');
const cfgPort = document.getElementById('cfgPort');
const cfgQueryPort = document.getElementById('cfgQueryPort');
const cfgRconEnabled = document.getElementById('cfgRconEnabled');
const cfgRconPort = document.getElementById('cfgRconPort');
const cfgMaxPlayers = document.getElementById('cfgMaxPlayers');
const cfgServerPassword = document.getElementById('cfgServerPassword');
const cfgServerAdminPassword = document.getElementById('cfgServerAdminPassword');
const cfgServerPVE = document.getElementById('cfgServerPVE');
const cfgNoBattlEye = document.getElementById('cfgNoBattlEye');
const saveSettingsBtn = document.getElementById('saveSettings');
const settingsStatus = document.getElementById('settingsStatus');

async function loadSettingsForm() {
  try {
    const cfg = await window.api.config.get();
    if (cfgMap) cfgMap.value = cfg.Map || 'TheIsland';
    if (cfgSessionName) cfgSessionName.value = cfg.SessionName || 'My Ark Server';
    if (cfgPort) cfgPort.value = cfg.Port ?? 7777;
    if (cfgQueryPort) cfgQueryPort.value = cfg.QueryPort ?? 27015;
    if (cfgRconEnabled) cfgRconEnabled.checked = !!cfg.RCONEnabled;
    if (cfgRconPort) cfgRconPort.value = cfg.RCONPort ?? 27020;
    if (cfgMaxPlayers) cfgMaxPlayers.value = cfg.MaxPlayers ?? 70;
    if (cfgServerPassword) cfgServerPassword.value = cfg.ServerPassword ?? '';
    if (cfgServerAdminPassword) cfgServerAdminPassword.value = cfg.ServerAdminPassword ?? '';
    if (cfgServerPVE) cfgServerPVE.checked = !!cfg.ServerPVE;
    if (cfgNoBattlEye) cfgNoBattlEye.checked = !!cfg.NoBattlEye;
  } catch {}
}

function validPort(n) { return Number.isInteger(n) && n >= 1 && n <= 65535; }
function coerceInt(v, def) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : def; }

if (saveSettingsBtn) {
  saveSettingsBtn.onclick = async () => {
    try {
      saveSettingsBtn.disabled = true;
      settingsStatus.textContent = 'Saving...';
      const port = coerceInt(cfgPort?.value, 7777);
      const qPort = coerceInt(cfgQueryPort?.value, 27015);
      const rconPort = coerceInt(cfgRconPort?.value, 27020);
      const maxPlayers = coerceInt(cfgMaxPlayers?.value, 70);
      if (!validPort(port) || !validPort(qPort) || !validPort(rconPort)) {
        throw new Error('Ports must be between 1 and 65535');
      }
      if (!(maxPlayers >= 1 && maxPlayers <= 255)) {
        throw new Error('Max Players must be between 1 and 255');
      }
      const patch = {
        Map: cfgMap ? cfgMap.value : 'TheIsland',
        SessionName: cfgSessionName ? cfgSessionName.value : 'My Ark Server',
        Port: port,
        QueryPort: qPort,
        RCONEnabled: cfgRconEnabled ? !!cfgRconEnabled.checked : false,
        RCONPort: rconPort,
        MaxPlayers: maxPlayers,
        ServerPassword: cfgServerPassword ? cfgServerPassword.value : '',
        ServerAdminPassword: cfgServerAdminPassword ? cfgServerAdminPassword.value : '',
        ServerPVE: cfgServerPVE ? !!cfgServerPVE.checked : false,
        NoBattlEye: cfgNoBattlEye ? !!cfgNoBattlEye.checked : false,
      };
      const res = await window.api.config.set(patch);
      settingsStatus.textContent = res.iniPath ? `Saved (INI: ${res.iniPath})` : 'Saved';
    } catch (e) {
      settingsStatus.textContent = 'Save failed';
      alert('Failed to save settings: ' + (e?.message || e));
    } finally {
      saveSettingsBtn.disabled = false;
      setTimeout(() => { if (settingsStatus) settingsStatus.textContent = ''; }, 2500);
    }
  };
}

// Load settings form on init
loadSettingsForm();

const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
const updateInfo = document.getElementById('updateInfo');
if (checkUpdatesBtn) {
  checkUpdatesBtn.onclick = async () => {
    try {
      checkUpdatesBtn.disabled = true;
      if (updateInfo) updateInfo.textContent = 'Checking...';
      const res = await window.api.updates.check();
      if (updateInfo) {
        if (res.remoteBuildId && res.currentBuildId) {
          updateInfo.textContent = res.updateAvailable
            ? `Update available: remote ${res.remoteBuildId}, current ${res.currentBuildId}`
            : `Up to date: ${res.currentBuildId}`;
        } else {
          updateInfo.textContent = 'Could not determine build IDs';
        }
      }
    } catch (e) {
      if (updateInfo) updateInfo.textContent = 'Update check failed';
    } finally {
      checkUpdatesBtn.disabled = false;
      setTimeout(() => { if (updateInfo && updateInfo.textContent.startsWith('Up to date')) updateInfo.textContent = ''; }, 5000);
    }
  };
}

// Theme toggle
(function themeInit(){
  const el = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  if (el) {
    el.addEventListener('click', () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (dark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('theme');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
    });
  }
})();
