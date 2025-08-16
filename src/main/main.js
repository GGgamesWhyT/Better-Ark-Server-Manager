const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
  name: 'settings',
  defaults: {
    steamApiKey: '',
    steamcmdPath: '',
    serverInstallPath: '',
    branch: 'stable',
    mods: [],
    serverConfig: {},
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: settings basic
ipcMain.handle('settings:get', async (_e) => store.store);
ipcMain.handle('settings:set', async (_e, patch) => {
  store.set(patch);
  return store.store;
});

// IPC: placeholder for mod search (will call Steam Web API later)
ipcMain.handle('mods:search', async (_e, _query, _page = 1) => {
  return { items: [], total: 0, hasMore: false };
});
