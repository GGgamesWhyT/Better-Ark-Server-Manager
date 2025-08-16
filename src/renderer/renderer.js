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
  await refreshModsList();
  await renderModsState();
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
    cachedSettings = await window.api.settings.set({ serverInstallPath: p });
    alert('Saved server install path.');
  });
}

async function ensureServerPath() {
  cachedSettings = await window.api.settings.get();
  if (!cachedSettings.serverInstallPath) {
    throw new Error('Set server install path in Install/Update tab first.');
  }
}

// Mods: add by ID
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
