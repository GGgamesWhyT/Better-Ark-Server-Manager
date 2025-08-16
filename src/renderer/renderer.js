// Simple tab navigation
const tabButtons = document.querySelectorAll('.tabs button');
const tabs = document.querySelectorAll('.tab');

tabButtons.forEach(btn => btn.addEventListener('click', () => {
  tabButtons.forEach(b => b.classList.remove('active'));
  tabs.forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(btn.dataset.tab).classList.add('active');
}));

// Load settings and hook simple save
(async function init() {
  const settings = await window.api.settings.get();
  const apiKeyEl = document.getElementById('steamApiKey');
  if (apiKeyEl && settings.steamApiKey) apiKeyEl.value = settings.steamApiKey;
})();

const saveApiKeyBtn = document.getElementById('saveApiKey');
if (saveApiKeyBtn) {
  saveApiKeyBtn.addEventListener('click', async () => {
    const key = document.getElementById('steamApiKey').value.trim();
    await window.api.settings.set({ steamApiKey: key });
    alert('Saved Steam Web API key.');
  });
}

// Mods search placeholder
const searchBtn = document.getElementById('searchMods');
const queryEl = document.getElementById('modQuery');
const resultsEl = document.getElementById('modResults');

if (searchBtn && queryEl && resultsEl) {
  searchBtn.addEventListener('click', async () => {
    const q = queryEl.value.trim();
    resultsEl.innerHTML = 'Searching...';
    const res = await window.api.mods.search(q, 1);
    if (!res.items.length) {
      resultsEl.innerHTML = '<em>No results (API integration coming next). You can still add by ID from the Workshop page.</em>';
      return;
    }
    resultsEl.innerHTML = '';
    res.items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'result';
      div.innerHTML = `<span>${item.title} <small>(${item.id})</small></span><button>Add</button>`;
      resultsEl.appendChild(div);
    });
  });
}
