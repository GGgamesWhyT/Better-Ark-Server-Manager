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

// Mods: add by ID (placeholder)
const addByIdBtn = document.getElementById('addModById');
const modIdInput = document.getElementById('modIdInput');
if (addByIdBtn && modIdInput) {
  addByIdBtn.addEventListener('click', async () => {
    const id = (modIdInput.value || '').trim();
    if (!/^\d+$/.test(id)) {
      alert('Please enter a valid numeric Workshop ID.');
      return;
    }
    alert(`Add mod ${id} (download/install via SteamCMD coming next).`);
  });
}
