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

async function refreshServerStatus() {
  if (!serverStatusEl) return;
  try {
    const st = await window.api.server.status();
    serverStatusEl.textContent = `Status: ${st.state}${st.pid ? ` (PID ${st.pid})` : ''}`;
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
  resetInstallProgress();
  await window.api.server.install(dir, branchSel ? branchSel.value : 'stable');
      alert('Server installed/updated.');
    } catch (e) {
      alert('Install failed: ' + (e?.message || e));
    } finally {
      installServerBtn.disabled = false;
      installServerBtn.textContent = 'Install';
      await refreshServerStatus();
    }
  });
}

if (updateServerBtn) {
  updateServerBtn.addEventListener('click', async () => {
    try {
      await ensureServerPath();
      updateServerBtn.disabled = true;
      updateServerBtn.textContent = 'Updating...';
  resetInstallProgress();
  await window.api.server.update();
      alert('Server updated.');
    } catch (e) {
      alert('Update failed: ' + (e?.message || e));
    } finally {
      updateServerBtn.disabled = false;
      updateServerBtn.textContent = 'Update Now';
      await refreshServerStatus();
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
  resetModProgress();
  await window.api.mods.addById(id);
      await refreshModsList();
      await renderModsState();
      alert('Mod added.');
    } catch (e) {
      alert('Failed to add mod: ' + (e?.message || e));
    } finally {
      addByIdBtn.disabled = false;
      addByIdBtn.textContent = 'Add Mod by ID';
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
          <button class="up" data-idx="${idx}">▲</button>
          <button class="down" data-idx="${idx}">▼</button>
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

function resetInstallProgress() {
  if (installProgress) installProgress.value = 0;
  if (installProgressMsg) installProgressMsg.textContent = '';
}
function resetModProgress() {
  if (modProgress) modProgress.value = 0;
  if (modProgressMsg) modProgressMsg.textContent = '';
}

function setupProgressHandlers() {
  if (!window.api.progress?.onUpdate) return;
  window.api.progress.onUpdate(({ taskId, type, percent, message }) => {
    if (taskId === 'server:install' || taskId === 'server:update') {
  if (type === 'progress' && installProgress && typeof percent === 'number') installProgress.value = percent;
  if (message && installProgressMsg) installProgressMsg.textContent = message;
      if (type === 'done' && installProgress) installProgress.value = 100;
    } else if (typeof taskId === 'string' && taskId.startsWith('mod:')) {
  if (type === 'progress' && modProgress && typeof percent === 'number') modProgress.value = percent;
  if (message && modProgressMsg) modProgressMsg.textContent = message;
      if (type === 'done' && modProgress) modProgress.value = 100;
    }
  });
}

// Logs
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
      // Keep autoscroll if near bottom
      const nearBottom = (logsOutput.scrollHeight - logsOutput.scrollTop - logsOutput.clientHeight) < 50;
      logsOutput.insertAdjacentText('beforeend', batch);
      // Trim very large logs to avoid UI lag (keep last ~200k chars)
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
